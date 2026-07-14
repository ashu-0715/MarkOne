import Test from '../models/Test.js';
import Question from '../models/Question.js';
import TestAttempt from '../models/TestAttempt.js';
import Class from '../models/Class.js';
import PDFDocument from 'pdfkit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const reportFontPath = path.join(currentDirectory, '../assets/fonts/NotoSansTamil.ttf');

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

const safeFilePart = (value, fallback) => {
  const cleaned = String(value || '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return cleaned || fallback;
};

const startReviewPage = (doc, continued = false) => {
  doc.addPage();
  doc.font('Tamil').fillColor('#1e293b').fontSize(15).text(continued ? 'Question review (continued)' : 'Question review');
  doc.moveDown(0.8);
};

export const createTest = async (req, res) => {
  try {
    const payload = { ...req.body, teacher: req.user._id };
    const classInfo = await Class.findOne({ _id: payload.class, teacher: req.user._id, isActive: true });
    if (!classInfo) return res.status(404).json({ message: 'Active class not found' });
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
    const activeClassIds = await Class.find({ teacher: req.user._id, isActive: true }).distinct('_id');
    const test = await Test.findOneAndUpdate(
      { _id: req.params.id, teacher: req.user._id, class: { $in: activeClassIds } },
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
    const activeClassIds = await Class.find({ teacher: req.user._id, isActive: true }).distinct('_id');
    const tests = await Test.find({ teacher: req.user._id, class: { $in: activeClassIds } })
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

// Student-facing: download a complete, private revision report for a submitted test.
export const downloadMyAttemptReport = async (req, res) => {
  try {
    const test = await Test.findOne({ _id: req.params.id, class: req.user.class }).populate('questions');
    if (!test) return res.status(404).json({ message: 'Test not found' });

    const attempt = await TestAttempt.findOne({
      test: test._id,
      student: req.user._id,
      status: { $in: ['submitted', 'auto_submitted'] },
    });
    if (!attempt) return res.status(404).json({ message: 'No submitted attempt found for this test' });

    const answersByQuestion = new Map(attempt.answers.map((answer) => [answer.question.toString(), answer]));
    const filename = `${safeFilePart(test.title, 'test')}-revision-report.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 45, size: 'A4', bufferPages: true, info: { Title: `${test.title} Revision Report` } });
    doc.pipe(res);
    doc.registerFont('Tamil', reportFontPath);
    doc.font('Tamil');

    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const contentX = doc.page.margins.left;

    doc.fillColor('#4f46e5').fontSize(9).text('MARKONE | PERSONAL REVISION REPORT', { align: 'center' });
    doc.moveDown(0.35);
    doc.fillColor('#172554').fontSize(21).text(test.title, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#475569').text(`Student: ${req.user.name} | Roll no.: ${req.user.rollNumber}`, { align: 'center' });
    doc.text(`Submitted: ${attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : 'Not available'}`, { align: 'center' });
    doc.moveDown();

    const summaryGap = 9;
    const summaryWidth = (contentWidth - summaryGap * 2) / 3;
    const summaryY = doc.y;
    const summaryCards = [
      { label: 'FINAL SCORE', value: `${attempt.score}/${test.totalMarks}`, color: '#4f46e5', background: '#eef2ff' },
      { label: 'PERCENTAGE', value: `${attempt.percentage}%`, color: '#0369a1', background: '#e0f2fe' },
      { label: 'TO REVISE', value: `${attempt.wrongCount + attempt.skippedCount} question(s)`, color: '#b45309', background: '#fef3c7' },
    ];
    summaryCards.forEach((card, index) => {
      const x = contentX + index * (summaryWidth + summaryGap);
      doc.roundedRect(x, summaryY, summaryWidth, 60, 8).fill(card.background);
      doc.fillColor(card.color).fontSize(8).text(card.label, x + 12, summaryY + 12, { width: summaryWidth - 24, align: 'center' });
      doc.fontSize(13).text(card.value, x + 12, summaryY + 30, { width: summaryWidth - 24, align: 'center' });
    });
    doc.y = summaryY + 80;

    doc.fillColor('#1e293b').fontSize(15).text('Question review');
    doc.fillColor('#64748b').fontSize(9).text('Review the amber and red cards first, then use the explanations to revise.');
    doc.moveDown(0.8);

    test.questions.forEach((question, index) => {
      const answer = answersByQuestion.get(question._id.toString());
      const status = answer?.isSkipped ? 'Skipped' : answer?.isCorrect ? 'Correct' : 'Incorrect';
      const statusColor = answer?.isSkipped ? '#b45309' : answer?.isCorrect ? '#15803d' : '#dc2626';
      const statusBackground = answer?.isSkipped ? '#fef3c7' : answer?.isCorrect ? '#dcfce7' : '#fee2e2';
      const textWidth = contentWidth - 36;
      doc.font('Tamil').fontSize(12);
      const questionHeight = doc.heightOfString(`${index + 1}. ${question.questionText}`, { width: textWidth });
      doc.fontSize(10);
      const answerHeight = doc.heightOfString(`Your answer: ${answer?.givenAnswer || 'Skipped'}`, { width: textWidth })
        + doc.heightOfString(`Correct answer: ${question.correctAnswer || 'Not available'}`, { width: textWidth });
      const explanationHeight = question.explanation
        ? doc.heightOfString(`Why: ${question.explanation}`, { width: textWidth })
        : 0;
      const cardHeight = 84 + questionHeight + answerHeight + (question.explanation ? 17 + explanationHeight : 0);
      if (doc.y + cardHeight > doc.page.height - doc.page.margins.bottom - 25) startReviewPage(doc, true);

      const cardY = doc.y;
      doc.roundedRect(contentX, cardY, contentWidth, cardHeight, 9).fill('#ffffff').strokeColor('#e2e8f0').stroke();
      doc.roundedRect(contentX, cardY, 6, cardHeight, 4).fill(statusColor);
      doc.roundedRect(contentX + 18, cardY + 14, 70, 20, 10).fill(statusBackground);
      doc.fillColor(statusColor).fontSize(8).text(status.toUpperCase(), contentX + 21, cardY + 20, { width: 64, align: 'center' });
      doc.fillColor('#0f172a').fontSize(12).text(`${index + 1}. ${question.questionText}`, contentX + 18, cardY + 44, { width: textWidth });

      let lineY = cardY + 50 + questionHeight;
      doc.fillColor('#64748b').fontSize(8).text('YOUR ANSWER', contentX + 18, lineY);
      lineY += 12;
      doc.fillColor(answer?.isCorrect ? '#15803d' : '#334155').fontSize(10).text(answer?.givenAnswer || 'Skipped', contentX + 18, lineY, { width: textWidth });
      lineY += doc.heightOfString(answer?.givenAnswer || 'Skipped', { width: textWidth }) + 5;
      doc.fillColor('#64748b').fontSize(8).text('CORRECT ANSWER', contentX + 18, lineY);
      lineY += 12;
      doc.fillColor('#15803d').fontSize(10).text(question.correctAnswer || 'Not available', contentX + 18, lineY, { width: textWidth });
      lineY += doc.heightOfString(question.correctAnswer || 'Not available', { width: textWidth }) + 5;
      if (question.explanation) {
        doc.fillColor('#64748b').fontSize(8).text('REVISION NOTE', contentX + 18, lineY);
        lineY += 12;
        doc.fillColor('#475569').fontSize(9).text(question.explanation, contentX + 18, lineY, { width: textWidth });
      }
      doc.y = cardY + cardHeight + 10;
    });

    const range = doc.bufferedPageRange();
    for (let page = 0; page < range.count; page += 1) {
      doc.switchToPage(page);
      doc.font('Tamil').fontSize(8).fillColor('#64748b').text(
        `Revision report | Page ${page + 1} of ${range.count}`,
        doc.page.margins.left,
        doc.page.height - 70,
        { align: 'center', width: doc.page.width - doc.page.margins.left - doc.page.margins.right }
      );
    }
    doc.end();
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate revision report', error: err.message });
  }
};

// Student-facing: list published tests for the student's class, plus their attempt status
export const getAvailableTestsForStudent = async (req, res) => {
  try {
    const activeClass = await Class.exists({ _id: req.user.class, isActive: true });
    if (!activeClass) return res.json({ tests: [] });
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
    const activeClass = await Class.exists({ _id: req.user.class, isActive: true });
    if (!activeClass) return res.status(404).json({ message: 'Test not available' });
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
    const activeClass = await Class.exists({ _id: req.user.class, isActive: true });
    if (!activeClass) return res.status(404).json({ message: 'Test not found' });
    const test = await Test.findOne({ _id: req.params.id, class: req.user.class, status: 'published' }).populate('questions');
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
