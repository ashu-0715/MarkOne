import Test from '../models/Test.js';
import Question from '../models/Question.js';
import TestAttempt from '../models/TestAttempt.js';

const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const getScheduleError = (test) => {
  const now = new Date();
  if (test.availableFrom && now < test.availableFrom) return 'This test has not started yet';
  if (test.availableUntil && now > test.availableUntil) return 'This test is closed';
  return '';
};

export const createTest = async (req, res) => {
  try {
    const payload = { ...req.body, teacher: req.user._id };
    if (payload.availableFrom) payload.availableFrom = new Date(payload.availableFrom);
    if (payload.availableUntil) payload.availableUntil = new Date(payload.availableUntil);
    if (payload.availableFrom && Number.isNaN(payload.availableFrom.getTime())) {
      return res.status(400).json({ message: 'Invalid schedule start date' });
    }
    if (payload.availableUntil && Number.isNaN(payload.availableUntil.getTime())) {
      return res.status(400).json({ message: 'Invalid schedule end date' });
    }
    if (payload.availableFrom && payload.availableUntil && payload.availableFrom >= payload.availableUntil) {
      return res.status(400).json({ message: 'Schedule end must be after schedule start' });
    }
    payload.totalStudents = Math.max(Number(payload.totalStudents) || 0, 0);
    const questions = await Question.find({ _id: { $in: payload.questions }, teacher: req.user._id });
    payload.totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

    const test = await Test.create(payload);
    res.status(201).json({ test });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create test', error: err.message });
  }
};

export const publishTest = async (req, res) => {
  try {
    const test = await Test.findOneAndUpdate(
      { _id: req.params.id, teacher: req.user._id },
      { status: 'published' },
      { new: true }
    );
    if (!test) return res.status(404).json({ message: 'Test not found' });
    res.json({ message: 'Test published', test });
  } catch (err) {
    res.status(500).json({ message: 'Failed to publish test', error: err.message });
  }
};

export const getMyTests = async (req, res) => {
  try {
    const tests = await Test.find({ teacher: req.user._id })
      .populate('questions', 'type subject chapter difficulty questionText options correctAnswer explanation marks imageUrl')
      .sort({ createdAt: -1 });
    res.json({ tests });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch tests', error: err.message });
  }
};

// Student-facing: fetch this student's own result for a given test, with explanations if allowed
export const getMyAttemptResult = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).populate('questions');
    if (!test) return res.status(404).json({ message: 'Test not found' });

    const attempt = await TestAttempt.findOne({ test: test._id, student: req.user._id });
    if (!attempt) return res.status(404).json({ message: 'No attempt found for this test' });

    const questionMap = new Map(test.questions.map((q) => [q._id.toString(), q]));
    const detailedAnswers = attempt.answers.map((a) => {
      const q = questionMap.get(a.question.toString());
      return {
        questionText: q?.questionText,
        chapter: q?.chapter,
        correctAnswer: test.showAnswersAfterSubmission ? q?.correctAnswer : undefined,
        explanation: test.showAnswersAfterSubmission ? q?.explanation : undefined,
        givenAnswer: a.givenAnswer,
        isCorrect: a.isCorrect,
        isSkipped: a.isSkipped,
      };
    });

    // Group by chapter to surface strong/weak chapters
    const chapterStats = {};
    detailedAnswers.forEach((a) => {
      const ch = a.chapter || 'General';
      chapterStats[ch] = chapterStats[ch] || { correct: 0, total: 0 };
      chapterStats[ch].total += 1;
      if (a.isCorrect) chapterStats[ch].correct += 1;
    });
    const chapterBreakdown = Object.entries(chapterStats).map(([chapter, s]) => ({
      chapter,
      accuracy: Math.round((s.correct / s.total) * 100),
    }));
    const strongChapters = chapterBreakdown.filter((c) => c.accuracy >= 70).map((c) => c.chapter);
    const weakChapters = chapterBreakdown.filter((c) => c.accuracy < 50).map((c) => c.chapter);

    res.json({
      test: { title: test.title, totalMarks: test.totalMarks, showAnswersAfterSubmission: test.showAnswersAfterSubmission },
      attempt,
      detailedAnswers,
      strongChapters,
      weakChapters,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch result', error: err.message });
  }
};

// Student-facing: list published tests for the student's class, plus their attempt status
export const getAvailableTestsForStudent = async (req, res) => {
  try {
    const now = new Date();
    const tests = await Test.find({
      class: req.user.class,
      status: 'published',
      $and: [
        { $or: [{ availableFrom: { $exists: false } }, { availableFrom: null }, { availableFrom: { $lte: now } }] },
        { $or: [{ availableUntil: { $exists: false } }, { availableUntil: null }, { availableUntil: { $gte: now } }] },
      ],
    })
      .select('title subject chapter timeLimitMinutes totalMarks availableFrom availableUntil createdAt')
      .sort({ createdAt: -1 });

    const attempts = await TestAttempt.find({ student: req.user._id }).select('test status score percentage');
    const attemptMap = new Map(attempts.map((a) => [a.test.toString(), a]));

    const withStatus = tests.map((t) => ({
      ...t.toObject(),
      attempt: attemptMap.get(t._id.toString()) || null,
    }));

    res.json({ tests: withStatus });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch available tests', error: err.message });
  }
};

// Student-facing: fetch a published test for their class, with answers stripped
export const getTestForStudent = async (req, res) => {
  try {
    const test = await Test.findOne({
      _id: req.params.id,
      class: req.user.class,
      status: 'published',
    }).populate('questions');
    if (!test) return res.status(404).json({ message: 'Test not available' });
    const scheduleError = getScheduleError(test);
    if (scheduleError) return res.status(403).json({ message: scheduleError });

    if (!test.allowRetest) {
      const existing = await TestAttempt.findOne({ test: test._id, student: req.user._id, status: { $ne: 'in_progress' } });
      if (existing) return res.status(403).json({ message: 'You have already attempted this test' });
    }

    let questions = test.questions.map((q) => ({
      _id: q._id,
      type: q.type,
      questionText: q.questionText,
      options: test.shuffleOptions ? shuffleArray(q.options) : q.options,
      marks: q.marks,
      imageUrl: q.imageUrl,
    }));
    if (test.shuffleQuestions) questions = shuffleArray(questions);

    res.json({
      test: {
        _id: test._id,
        title: test.title,
        timeLimitMinutes: test.timeLimitMinutes,
        totalMarks: test.totalMarks,
        negativeMarking: test.negativeMarking,
        autoSubmit: test.autoSubmit,
        questions,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load test', error: err.message });
  }
};

// Student submits answers -> server grades against the real Question docs
export const submitTestAttempt = async (req, res) => {
  try {
    const { answers, status } = req.body; // answers: [{ questionId, givenAnswer, timeTakenSeconds }]
    const test = await Test.findById(req.params.id).populate('questions');
    if (!test) return res.status(404).json({ message: 'Test not found' });
    const scheduleError = getScheduleError(test);
    if (scheduleError) return res.status(403).json({ message: scheduleError });

    const questionMap = new Map(test.questions.map((q) => [q._id.toString(), q]));
    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;
    let score = 0;
    let totalTime = 0;

    const gradedAnswers = answers.map((a) => {
      const q = questionMap.get(a.questionId);
      totalTime += a.timeTakenSeconds || 0;
      if (!a.givenAnswer) {
        skippedCount += 1;
        return { question: q._id, givenAnswer: null, isCorrect: false, isSkipped: true, timeTakenSeconds: a.timeTakenSeconds || 0 };
      }
      let studentAnswer = (a.givenAnswer || "").trim().toLowerCase();
let correctAnswer = (q.correctAnswer || "").trim().toLowerCase();

// Remove option labels like "a)", "b)", "c)", "d)"
studentAnswer = studentAnswer.replace(/^[a-d]\)\s*/i, "");
correctAnswer = correctAnswer.replace(/^[a-d]\)\s*/i, "");

const isCorrect = studentAnswer === correctAnswer;
      if (isCorrect) {
        correctCount += 1;
        score += q.marks;
      } else {
        wrongCount += 1;
        if (test.negativeMarking?.enabled) score -= test.negativeMarking.value;
      }
      return { question: q._id, givenAnswer: a.givenAnswer, isCorrect, isSkipped: false, timeTakenSeconds: a.timeTakenSeconds || 0 };
    });

    score = Math.max(score, 0);
    const percentage = test.totalMarks > 0 ? Math.round((score / test.totalMarks) * 10000) / 100 : 0;

    const attempt = await TestAttempt.findOneAndUpdate(
      { test: test._id, student: req.user._id },
      {
        answers: gradedAnswers,
        score,
        percentage,
        correctCount,
        wrongCount,
        skippedCount,
        averageTimePerQuestion: answers.length ? Math.round(totalTime / answers.length) : 0,
        submittedAt: new Date(),
        status: status === 'auto_submitted' ? 'auto_submitted' : 'submitted',
      },
      { upsert: true, new: true }
    );

    res.json({ message: 'Test submitted', attempt, showAnswers: test.showAnswersAfterSubmission });
  } catch (err) {
    res.status(500).json({ message: 'Failed to submit test', error: err.message });
  }
};
