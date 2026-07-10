import crypto from 'crypto';
import Question from '../models/Question.js';
import { generateQuestionsFromText, generateQuestionsFromPrompt } from '../services/aiService.js';

const hashContent = (text) => crypto.createHash('sha256').update(text.trim().toLowerCase()).digest('hex');

export const createQuestion = async (req, res) => {
  try {
    const payload = {
  ...req.body,
  teacher: req.user._id,
};

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

// Search/filter the bank: by subject, chapter, difficulty, type, keyword
export const getQuestionBank = async (req, res) => {
  try {
    const { subject, chapter, difficulty, type, search, page = 1, limit = 25 } = req.query;
    const filter = { teacher: req.user._id };
    if (subject) filter.subject = subject;
    if (chapter) filter.chapter = chapter;
    if (difficulty) filter.difficulty = difficulty;
    if (type) filter.type = type;
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
