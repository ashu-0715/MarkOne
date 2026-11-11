import crypto from 'crypto';
import mongoose from 'mongoose';
import Question from '../models/Question.js';
import QuestionSet from '../models/QuestionSet.js';
import { generateQuestionsFromText, generateQuestionsFromPrompt } from '../services/aiService.js';

const hashContent = (text) => crypto.createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
const normalizeTitle = (title) => title.trim().replace(/\s+/g, ' ').toLowerCase();
const normalizedField = (field) => ({ $toLower: { $trim: { input: { $ifNull: [field, ''] } } } });
const questionIdentity = {
  type: '$type',
  subject: normalizedField('$subject'),
  chapter: normalizedField('$chapter'),
  difficulty: '$difficulty',
  questionText: normalizedField('$questionText'),
  options: {
    $map: {
      input: { $ifNull: ['$options', []] },
      as: 'option',
      in: { $toLower: { $trim: { input: { $ifNull: ['$$option', ''] } } } },
    },
  },
  correctAnswer: normalizedField('$correctAnswer'),
  explanation: normalizedField('$explanation'),
  imageUrl: '$imageUrl',
  marks: { $ifNull: ['$marks', 1] },
};

export const getQuestionSets = async (req, res) => {
  try {
    const [questionSets, ungroupedQuestionCount] = await Promise.all([QuestionSet.aggregate([
      { $match: { teacher: req.user._id } },
      {
        $lookup: {
          from: 'questions',
          let: { setId: '$_id', setTeacher: '$teacher' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$questionSet', '$$setId'] },
                    { $eq: ['$teacher', '$$setTeacher'] },
                  ],
                },
              },
            },
            { $group: { _id: questionIdentity, copies: { $sum: 1 } } },
            { $group: { _id: null, uniqueCount: { $sum: 1 }, savedCount: { $sum: '$copies' } } },
          ],
          as: 'questions',
        },
      },
      {
        $project: {
          title: 1,
          createdAt: 1,
          updatedAt: 1,
          questionCount: { $ifNull: [{ $arrayElemAt: ['$questions.uniqueCount', 0] }, 0] },
          savedQuestionCount: { $ifNull: [{ $arrayElemAt: ['$questions.savedCount', 0] }, 0] },
        },
      },
      { $sort: { updatedAt: -1, title: 1 } },
    ]), Question.countDocuments({ teacher: req.user._id, questionSet: { $exists: false } })]);
    res.set('Cache-Control', 'private, no-store, max-age=0');
    res.json({ questionSets, ungroupedQuestionCount });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch question sets', error: err.message });
  }
};

export const createQuestionSet = async (req, res) => {
  try {
    const title = req.body.title?.trim();
    if (!title) return res.status(400).json({ message: 'Test Title is required' });
    const questionSet = await QuestionSet.create({ teacher: req.user._id, title, normalizedTitle: normalizeTitle(title) });
    res.status(201).json({ questionSet });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'A Question Set with this title already exists' });
    res.status(500).json({ message: 'Failed to create Question Set', error: err.message });
  }
};

export const updateQuestionSet = async (req, res) => {
  try {
    const title = req.body.title?.trim();
    if (!title) return res.status(400).json({ message: 'Test Title is required' });
    const questionSet = await QuestionSet.findOneAndUpdate(
      { _id: req.params.id, teacher: req.user._id },
      { title, normalizedTitle: normalizeTitle(title) },
      { new: true, runValidators: true }
    );
    if (!questionSet) return res.status(404).json({ message: 'Question Set not found' });
    res.json({ questionSet });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'A Question Set with this title already exists' });
    res.status(500).json({ message: 'Failed to update Question Set', error: err.message });
  }
};

export const deleteQuestionSet = async (req, res) => {
  try {
    const questionSet = await QuestionSet.findOneAndDelete({ _id: req.params.id, teacher: req.user._id });
    if (!questionSet) return res.status(404).json({ message: 'Question Set not found' });
    // Keep questions (and any existing tests that reference them) safe; they become ungrouped.
    await Question.updateMany({ teacher: req.user._id, questionSet: questionSet._id }, { $unset: { questionSet: 1 } });
    res.json({ message: 'Question Set deleted. Its questions were kept in your Question Bank.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete Question Set', error: err.message });
  }
};

export const createQuestion = async (req, res) => {
  try {
    const { allowSimilarQuestions = false, ...questionData } = req.body;
    const payload = {
  ...questionData,
  teacher: req.user._id,
};

    if (!payload.questionSet) return res.status(400).json({ message: 'Test Title is required' });
    const questionSet = await QuestionSet.findOne({ _id: payload.questionSet, teacher: req.user._id });
    if (!questionSet) return res.status(400).json({ message: 'Selected Question Set was not found' });

// Normalize correct answer
if (payload.correctAnswer) {
  payload.correctAnswer = payload.correctAnswer
    .replace(/^[a-dA-D][).]\s*/, "")   // removes "a) ", "b. ", etc.
    .trim()
    .toLowerCase();
}
    payload.contentHash = hashContent(payload.questionText);

    if (!allowSimilarQuestions) {
      const duplicate = await Question.findOne({ teacher: req.user._id, contentHash: payload.contentHash });
      if (duplicate) {
        return res.status(409).json({ message: 'A very similar question already exists in your bank', duplicate });
      }
    }

    const question = await Question.create(payload);
    res.status(201).json({ question });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save question', error: err.message });
  }
};

export const updateQuestion = async (req, res) => {
  try {
    const payload = { ...req.body };

    if (payload.questionSet) {
      const questionSet = await QuestionSet.findOne({ _id: payload.questionSet, teacher: req.user._id });
      if (!questionSet) return res.status(400).json({ message: 'Selected Question Set was not found' });
    }

    if (payload.correctAnswer) {
      payload.correctAnswer = payload.correctAnswer
        .replace(/^[a-dA-D][).]\s*/, '')
        .trim()
        .toLowerCase();
    }

    if (payload.questionText) {
      payload.contentHash = hashContent(payload.questionText);
      const duplicate = await Question.findOne({
        teacher: req.user._id,
        contentHash: payload.contentHash,
        _id: { $ne: req.params.id },
      });
      if (duplicate) {
        return res.status(409).json({ message: 'A very similar question already exists in your bank', duplicate });
      }
    }

    const question = await Question.findOneAndUpdate(
      { _id: req.params.id, teacher: req.user._id },
      payload,
      { new: true, runValidators: true }
    );
    if (!question) return res.status(404).json({ message: 'Question not found' });
    res.json({ question });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update question', error: err.message });
  }
};

export const deleteQuestions = async (req, res) => {
  try {
    const { ids } = req.body; // array of question IDs, supports bulk delete
    await Question.deleteMany({ _id: { $in: ids }, teacher: req.user._id });
    res.json({ message: `${ids.length} question(s) deleted` });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete questions', error: err.message });
  }
};

// Move selected legacy questions into a newly-created or existing Question Set.
export const assignQuestionsToSet = async (req, res) => {
  try {
    const { ids, questionSet } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'Select at least one question' });
    const set = await QuestionSet.findOne({ _id: questionSet, teacher: req.user._id });
    if (!set) return res.status(404).json({ message: 'Question Set not found' });

    const result = await Question.updateMany(
      { _id: { $in: ids }, teacher: req.user._id, questionSet: { $exists: false } },
      { $set: { questionSet: set._id } }
    );
    res.json({ message: `${result.modifiedCount} question(s) added to ${set.title}`, movedCount: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: 'Failed to group questions', error: err.message });
  }
};

// Search/filter the bank: by subject, chapter, difficulty, type, keyword
export const getQuestionBank = async (req, res) => {
  try {
    const { subject, chapter, difficulty, type, search, questionSet, page = 1, limit = 25 } = req.query;
    const filter = { teacher: req.user._id };
    if (subject) filter.subject = subject;
    if (chapter) filter.chapter = chapter;
    if (difficulty) filter.difficulty = difficulty;
    if (type) filter.type = type;
    if (questionSet === 'ungrouped') filter.questionSet = { $exists: false };
    else if (questionSet) {
      if (!mongoose.isValidObjectId(questionSet)) {
        return res.json({ questions: [], total: 0, page: Number(page), totalPages: 0 });
      }
      filter.questionSet = new mongoose.Types.ObjectId(questionSet);
    }
    if (search) filter.questionText = { $regex: search, $options: 'i' };

    let questions;
    let total;
    if (questionSet && questionSet !== 'ungrouped') {
      const result = await Question.aggregate([
        { $match: filter },
        { $sort: { createdAt: -1, _id: 1 } },
        {
          $group: {
            _id: questionIdentity,
            question: { $first: '$$ROOT' },
            copies: { $sum: 1 },
          },
        },
        {
          $replaceRoot: {
            newRoot: { $mergeObjects: ['$question', { duplicateCopies: { $subtract: ['$copies', 1] } }] },
          },
        },
        { $sort: { createdAt: -1, _id: 1 } },
        {
          $facet: {
            questions: [{ $skip: (Number(page) - 1) * Number(limit) }, { $limit: Number(limit) }],
            count: [{ $count: 'total' }],
          },
        },
      ]);
      questions = result[0]?.questions || [];
      total = result[0]?.count?.[0]?.total || 0;
    } else {
      [questions, total] = await Promise.all([
        Question.find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip((Number(page) - 1) * Number(limit))
          .limit(Number(limit)),
        Question.countDocuments(filter),
      ]);
    }
    res.set('Cache-Control', 'private, no-store, max-age=0');
    res.json({ questions, total, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch question bank', error: err.message });
  }
};

// Converts questions pasted in from ChatGPT/any source (plain text, one per block)
// into structured, editable question objects. Best-effort heuristic parser.
export const parsePastedQuestions = async (req, res) => {
  try {
    const { rawText, questionSet: requestedQuestionSet } = req.body;
    if (typeof rawText !== 'string' || !rawText.trim()) {
      return res.status(400).json({ message: 'Paste at least one question before importing.' });
    }

    let questionSet = null;
    if (requestedQuestionSet && requestedQuestionSet !== 'ungrouped') {
      if (!mongoose.isValidObjectId(requestedQuestionSet)) {
        return res.status(400).json({ message: 'The selected Question Set is invalid. Reopen it and retry.' });
      }
      questionSet = await QuestionSet.findOne({ _id: requestedQuestionSet, teacher: req.user._id });
      if (!questionSet) {
        return res.status(404).json({ message: 'The selected Question Set was not found for your account. Nothing was imported.' });
      }
    }
    const blocks = [];
    let currentBlock = [];
    rawText.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        if (currentBlock.length) blocks.push(currentBlock);
        currentBlock = [];
        return;
      }
      if (/^\d+[\).]\s+/.test(trimmed) && currentBlock.length) {
        blocks.push(currentBlock);
        currentBlock = [];
      }
      currentBlock.push(trimmed);
    });
    if (currentBlock.length) blocks.push(currentBlock);

    const parseErrors = [];
    const parsed = blocks.map((lines, index) => {
      const firstLine = lines[0].replace(/^\d+[\).]?\s*/, '');
      const questionLines = [firstLine];
      const options = [];
      let correctAnswer = '';
      let sawOption = false;

      lines.slice(1).forEach((line) => {
        const optionMatch = line.match(/^([A-Da-d])[\).]\s*(.+)$/);
        if (optionMatch) {
          sawOption = true;
          options.push(optionMatch[2].trim());
        } else if (/^answer[:\-]/i.test(line)) {
          correctAnswer = line.replace(/^answer[:\-]\s*/i, '');
        } else if (!sawOption && !correctAnswer) {
          questionLines.push(line);
        } else {
          parseErrors.push(index + 1);
        }
      });

      return {
        type: options.length ? 'mcq' : 'fill_blank',
        questionText: questionLines.join(' ').trim(),
        options,
        correctAnswer,
        marks: 1,
        source: 'pasted',
      };
    });

    if (parseErrors.length) {
      const blocksWithErrors = [...new Set(parseErrors)];
      return res.status(400).json({
        message: `Check the formatting in question block(s): ${blocksWithErrors.join(', ')}. Nothing was imported.`,
        invalidBlocks: blocksWithErrors,
      });
    }

    const documents = parsed.map((question) => {
      const correctAnswer = question.correctAnswer
        .replace(/^[a-d][).]\s*/i, '')
        .trim()
        .toLowerCase();
      return new Question({
        ...question,
        correctAnswer,
        subject: req.body.subject?.trim() || 'General',
        chapter: req.body.chapter?.trim() || 'General',
        difficulty: req.body.difficulty || 'medium',
        teacher: req.user._id,
        ...(questionSet ? { questionSet: questionSet._id } : {}),
        source: 'pasted',
        contentHash: hashContent(question.questionText),
      });
    });

    const invalidBlocks = (await Promise.all(documents.map(async (document, index) => {
      try {
        await document.validate();
        if (document.type === 'mcq' && !document.options.some(
          (option) => option.trim().toLowerCase() === document.correctAnswer
        )) {
          return index + 1;
        }
        return null;
      } catch {
        return index + 1;
      }
    }))).filter(Boolean);

    if (invalidBlocks.length) {
      return res.status(400).json({
        message: `Fix the answer or required fields in question block(s): ${invalidBlocks.join(', ')}. Nothing was imported.`,
        invalidBlocks,
      });
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Question.insertMany(documents, { session, ordered: true });
      });
    } finally {
      await session.endSession();
    }

    const ungroupedQuestionCount = await Question.countDocuments({
      teacher: req.user._id,
      questionSet: { $exists: false },
    });
    res.status(201).json({
      importedCount: documents.length,
      questionSetId: questionSet?._id?.toString() || 'ungrouped',
      ungroupedQuestionCount,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to parse pasted questions', error: err.message });
  }
};

export const generateFromLesson = async (req, res) => {
  try {
    const { lessonText, types, difficulty, count } = req.body;
    const questions = await generateQuestionsFromText({ lessonText, types, difficulty, count });
    res.json({ questions });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

export const generateFromPrompt = async (req, res) => {
  try {
    const { prompt, count, difficulty } = req.body;
    const questions = await generateQuestionsFromPrompt({ prompt, count, difficulty });
    res.json({ questions });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};
