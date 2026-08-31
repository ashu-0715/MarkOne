import crypto from 'crypto';
import Question from '../models/Question.js';
import QuestionSet from '../models/QuestionSet.js';
import { generateQuestionsFromText, generateQuestionsFromPrompt } from '../services/aiService.js';

const hashContent = (text) => crypto.createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
const normalizeTitle = (title) => title.trim().replace(/\s+/g, ' ').toLowerCase();

export const getQuestionSets = async (req, res) => {
  try {
    const [questionSets, ungroupedQuestionCount] = await Promise.all([QuestionSet.aggregate([
      { $match: { teacher: req.user._id } },
      { $lookup: { from: 'questions', localField: '_id', foreignField: 'questionSet', as: 'questions' } },
      { $project: { title: 1, createdAt: 1, updatedAt: 1, questionCount: { $size: '$questions' } } },
      { $sort: { updatedAt: -1, title: 1 } },
    ]), Question.countDocuments({ teacher: req.user._id, questionSet: { $exists: false } })]);
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
    const payload = {
  ...req.body,
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

    const duplicate = await Question.findOne({ teacher: req.user._id, contentHash: payload.contentHash });
    if (duplicate) {
      return res.status(409).json({ message: 'A very similar question already exists in your bank', duplicate });
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
    else if (questionSet) filter.questionSet = questionSet;
    if (search) filter.questionText = { $regex: search, $options: 'i' };

    const [questions, total] = await Promise.all([
      Question.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      Question.countDocuments(filter),
    ]);

    res.json({ questions, total, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch question bank', error: err.message });
  }
};

// Converts questions pasted in from ChatGPT/any source (plain text, one per block)
// into structured, editable question objects. Best-effort heuristic parser.
export const parsePastedQuestions = async (req, res) => {
  try {
    const { rawText } = req.body;
    const blocks = rawText.split(/\n\s*\n/).filter(Boolean);

    const parsed = blocks.map((block) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      const questionText = lines[0]?.replace(/^\d+[\).]?\s*/, '') || '';
      const options = lines
        .slice(1)
        .filter((l) => /^[A-Da-d][\).]/.test(l))
        .map((l) => l.replace(/^[A-Da-d][\).]\s*/, ''));
      const answerLine = lines.find((l) => /^answer[:\-]/i.test(l));
      const correctAnswer = answerLine ? answerLine.replace(/^answer[:\-]\s*/i, '') : '';

      return {
        type: options.length ? 'mcq' : 'fill_blank',
        questionText,
        options,
        correctAnswer,
        marks: 1,
        source: 'pasted',
      };
    });

    res.json({ questions: parsed });
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
