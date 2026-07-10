import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import Test from '../models/Test.js';
import TestAttempt from '../models/TestAttempt.js';
import Student from '../models/Student.js';
import Class from '../models/Class.js';

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round((value || 0) * factor) / factor;
};

const getBand = (percentage) => {
  if (percentage >= 80) return 'Excellent';
  if (percentage >= 60) return 'Good';
  if (percentage >= 40) return 'Needs practice';
  return 'Needs attention';
};

const buildChapterBreakdown = (answers = []) => {
  const chapterStats = new Map();

  answers.forEach((answer) => {
    const chapter = answer.question?.chapter || 'General';
    const current = chapterStats.get(chapter) || { chapter, correct: 0, wrong: 0, skipped: 0, total: 0 };
    current.total += 1;
    if (answer.isSkipped) current.skipped += 1;
    else if (answer.isCorrect) current.correct += 1;
    else current.wrong += 1;
    chapterStats.set(chapter, current);
  });

  return [...chapterStats.values()].map((item) => ({
    ...item,
    accuracy: item.total ? round((item.correct / item.total) * 100) : 0,
  }));
};

const mapAttempt = (attempt) => {
  const answers = attempt.answers.map((answer) => ({
    questionId: answer.question?._id,
    questionText: answer.question?.questionText || 'Question unavailable',
    chapter: answer.question?.chapter || 'General',
    difficulty: answer.question?.difficulty || 'medium',
    marks: answer.question?.marks || 0,
    givenAnswer: answer.givenAnswer || 'Skipped',
    correctAnswer: answer.question?.correctAnswer || '',
    isCorrect: answer.isCorrect,
    isSkipped: answer.isSkipped,
    timeTakenSeconds: answer.timeTakenSeconds || 0,
  }));
  const chapterBreakdown = buildChapterBreakdown(attempt.answers);

  return {
    attemptId: attempt._id,
    testId: attempt.test?._id,
    testTitle: attempt.test?.title || 'Untitled test',
    subject: attempt.test?.subject || '',
    totalMarks: attempt.test?.totalMarks || 0,
    score: attempt.score,
    percentage: round(attempt.percentage),
    performanceBand: getBand(attempt.percentage),
    correctCount: attempt.correctCount,
    wrongCount: attempt.wrongCount,
    skippedCount: attempt.skippedCount,
    averageTimePerQuestion: attempt.averageTimePerQuestion,
    submittedAt: attempt.submittedAt,
    status: attempt.status,
    chapterBreakdown,
    strongChapters: chapterBreakdown.filter((c) => c.accuracy >= 70).map((c) => c.chapter),
    weakChapters: chapterBreakdown.filter((c) => c.accuracy < 50).map((c) => c.chapter),
    answers,
  };
};

const buildClassAnalysis = async (classId, teacherId, filters = {}) => {
  const { testId } = filters;
  const classInfo = await Class.findOne({ _id: classId, teacher: teacherId }).select('name subject classCode studentCount');
  if (!classInfo) return null;

  const [students, allTests] = await Promise.all([
    Student.find({ class: classId, teacher: teacherId, isActive: true })
      .select('name rollNumber className section')
      .sort({ rollNumber: 1, name: 1 }),
    Test.find({ class: classId, teacher: teacherId }).select('_id title subject totalMarks totalStudents').sort({ createdAt: -1 }),
  ]);

  const tests = testId
    ? allTests.filter((test) => test._id.toString() === testId)
    : allTests;

  const testIds = tests.map((test) => test._id);
  const attempts = await TestAttempt.find({ test: { $in: testIds }, status: { $ne: 'in_progress' } })
    .populate('student', 'name rollNumber className section')
    .populate('test', 'title subject totalMarks')
    .populate('answers.question', 'questionText chapter difficulty marks correctAnswer')
    .sort({ submittedAt: -1 });

  const attemptsByStudent = new Map();
  attempts.forEach((attempt) => {
    const studentId = attempt.student?._id?.toString();
    if (!studentId) return;
    const current = attemptsByStudent.get(studentId) || [];
    current.push(mapAttempt(attempt));
    attemptsByStudent.set(studentId, current);
  });

  const studentsReport = students.map((student) => {
    const studentAttempts = attemptsByStudent.get(student._id.toString()) || [];
    const averagePercentage = studentAttempts.length
      ? round(studentAttempts.reduce((sum, attempt) => sum + attempt.percentage, 0) / studentAttempts.length)
      : 0;
    const allChapters = studentAttempts.flatMap((attempt) => attempt.chapterBreakdown);
    const weakChapters = [...new Set(allChapters.filter((c) => c.accuracy < 50).map((c) => c.chapter))];
    const strongChapters = [...new Set(allChapters.filter((c) => c.accuracy >= 70).map((c) => c.chapter))];

    return {
      student: {
        _id: student._id,
        name: student.name,
        rollNumber: student.rollNumber,
        className: student.className,
        section: student.section,
      },
      attemptedTests: studentAttempts.length,
      totalTests: tests.length,
      averagePercentage,
      performanceBand: studentAttempts.length ? getBand(averagePercentage) : 'Not attempted',
      strongChapters,
      weakChapters,
      attempts: studentAttempts,
    };
  });

  const attemptedStudents = studentsReport.filter((student) => student.attemptedTests > 0);
  const visibleStudents = testId ? attemptedStudents : studentsReport;
  const configuredTotalStudents = tests.reduce(
    (max, test) => Math.max(max, Number(test.totalStudents) || 0),
    0
  );
  const expectedStudents = configuredTotalStudents || students.length;
  const classAverage = attemptedStudents.length
    ? round(attemptedStudents.reduce((sum, student) => sum + student.averagePercentage, 0) / attemptedStudents.length)
    : 0;

  return {
    class: classInfo,
    summary: {
      totalStudents: expectedStudents,
      joinedStudents: students.length,
      displayedStudents: visibleStudents.length,
      totalTests: tests.length,
      availableTests: allTests.length,
      totalAttempts: attempts.length,
      attemptedStudents: attemptedStudents.length,
      classAverage,
    },
    availableTests: allTests.map((test) => ({
      testId: test._id,
      title: test.title,
      subject: test.subject,
      totalMarks: test.totalMarks,
    })),
    tests: tests.map((test) => {
      const testAttempts = attempts.filter((attempt) => attempt.test?._id?.toString() === test._id.toString());
      return {
        testId: test._id,
        title: test.title,
        subject: test.subject,
        totalMarks: test.totalMarks,
        attemptCount: testAttempts.length,
        averageScore: testAttempts.length
          ? round(testAttempts.reduce((sum, attempt) => sum + attempt.percentage, 0) / testAttempts.length)
          : 0,
      };
    }),
    students: visibleStudents,
  };
};

export const getClassReport = async (req, res) => {
  try {
    const { classId } = req.params;
    const analysis = await buildClassAnalysis(classId, req.user._id, { testId: req.query.testId });
    if (!analysis) return res.status(404).json({ message: 'Class not found' });

    res.json({ report: analysis.tests, analysis });
  } catch (err) {
    res.status(500).json({ message: 'Failed to build class report', error: err.message });
  }
};

export const getStudentReport = async (req, res) => {
  try {
    const { studentId } = req.params;
    const student = await Student.findOne({ _id: studentId, teacher: req.user._id });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const attempts = await TestAttempt.find({ student: studentId, status: { $ne: 'in_progress' } })
      .populate('test', 'title subject totalMarks')
      .populate('answers.question', 'questionText chapter difficulty marks correctAnswer')
      .sort({ submittedAt: -1 });
    res.json({ student, attempts: attempts.map(mapAttempt) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to build student report', error: err.message });
  }
};

export const getQuestionAnalysis = async (req, res) => {
  try {
    const { testId } = req.params;
    const test = await Test.findOne({ _id: testId, teacher: req.user._id });
    if (!test) return res.status(404).json({ message: 'Test not found' });

    const attempts = await TestAttempt.find({ test: testId, status: { $ne: 'in_progress' } });

    const tally = new Map();
    for (const attempt of attempts) {
      for (const ans of attempt.answers) {
        const key = ans.question.toString();
        const entry = tally.get(key) || { correct: 0, wrong: 0, skipped: 0 };
        if (ans.isSkipped) entry.skipped += 1;
        else if (ans.isCorrect) entry.correct += 1;
        else entry.wrong += 1;
        tally.set(key, entry);
      }
    }

    const analysis = [...tally.entries()].map(([questionId, counts]) => ({
      questionId,
      ...counts,
      total: counts.correct + counts.wrong + counts.skipped,
      wrongRate: round((counts.wrong / (counts.correct + counts.wrong + counts.skipped || 1)) * 100),
    }));

    analysis.sort((a, b) => b.wrongRate - a.wrongRate);
    res.json({ analysis });
  } catch (err) {
    res.status(500).json({ message: 'Failed to build question analysis', error: err.message });
  }
};

export const exportClassReportExcel = async (req, res) => {
  try {
    const { classId } = req.params;
    const analysis = await buildClassAnalysis(classId, req.user._id, { testId: req.query.testId });
    if (!analysis) return res.status(404).json({ message: 'Class not found' });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Class Report');
    sheet.columns = [
      { header: 'Student Name', key: 'name', width: 25 },
      { header: 'Roll Number', key: 'roll', width: 15 },
      { header: 'Test', key: 'test', width: 25 },
      { header: 'Score', key: 'score', width: 12 },
      { header: 'Percentage', key: 'percentage', width: 12 },
      { header: 'Correct', key: 'correct', width: 10 },
      { header: 'Wrong', key: 'wrong', width: 10 },
      { header: 'Skipped', key: 'skipped', width: 10 },
      { header: 'Weak Chapters', key: 'weakChapters', width: 30 },
    ];

    analysis.students.forEach((studentReport) => {
      if (!studentReport.attempts.length) {
        sheet.addRow({
          name: studentReport.student.name,
          roll: studentReport.student.rollNumber,
          test: 'No submitted attempts',
        });
        return;
      }

      studentReport.attempts.forEach((attempt) => {
        sheet.addRow({
          name: studentReport.student.name,
          roll: studentReport.student.rollNumber,
          test: attempt.testTitle,
          score: `${attempt.score}/${attempt.totalMarks}`,
          percentage: attempt.percentage,
          correct: attempt.correctCount,
          wrong: attempt.wrongCount,
          skipped: attempt.skippedCount,
          weakChapters: attempt.weakChapters.join(', ') || 'None',
        });
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=class-report.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ message: 'Failed to export report', error: err.message });
  }
};

export const exportClassReportPdf = async (req, res) => {
  try {
    const { classId } = req.params;
    const analysis = await buildClassAnalysis(classId, req.user._id, { testId: req.query.testId });
    if (!analysis) return res.status(404).json({ message: 'Class not found' });

    const safeFileName = analysis.class.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${safeFileName || 'class'}-report.pdf`);

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    doc.fontSize(18).fillColor('#111').text(`${analysis.class.name} Report`, { align: 'center' });
    doc
      .fontSize(10)
      .fillColor('#555')
      .text(`Subject: ${analysis.class.subject} | Class code: ${analysis.class.classCode}`, { align: 'center' });
    doc.moveDown();
    doc.fillColor('#111').fontSize(11).text(
      `Students: ${analysis.summary.totalStudents} | Tests: ${analysis.summary.totalTests} | Attempts: ${analysis.summary.totalAttempts} | Class average: ${analysis.summary.classAverage}%`
    );
    doc.moveDown();

    analysis.students.forEach((studentReport, index) => {
      if (index > 0) doc.moveDown();
      doc.fontSize(13).fillColor('#111').text(`${studentReport.student.name} (Roll ${studentReport.student.rollNumber})`);
      doc
        .fontSize(10)
        .fillColor('#444')
        .text(`Average: ${studentReport.averagePercentage}% | Tests attempted: ${studentReport.attemptedTests}/${studentReport.totalTests} | ${studentReport.performanceBand}`);

      if (!studentReport.attempts.length) {
        doc.fontSize(10).fillColor('#777').text('No submitted attempts yet.');
        return;
      }

      studentReport.attempts.forEach((attempt) => {
        doc.fontSize(10).fillColor('#111').text(`${attempt.testTitle}: ${attempt.score}/${attempt.totalMarks} (${attempt.percentage}%)`);
        doc
          .fillColor('#555')
          .text(`Correct: ${attempt.correctCount} | Wrong: ${attempt.wrongCount} | Skipped: ${attempt.skippedCount} | Avg time/question: ${attempt.averageTimePerQuestion}s`);
        doc.text(`Strong chapters: ${attempt.strongChapters.join(', ') || 'None'}`);
        doc.text(`Needs revision: ${attempt.weakChapters.join(', ') || 'None'}`);
        attempt.answers.forEach((answer, answerIndex) => {
          const result = answer.isSkipped ? 'Skipped' : answer.isCorrect ? 'Correct' : 'Wrong';
          doc
            .fontSize(9)
            .fillColor('#333')
            .text(`${answerIndex + 1}. ${answer.questionText}`);
          doc
            .fillColor('#666')
            .text(`Chapter: ${answer.chapter} | Result: ${result} | Answer: ${answer.givenAnswer}${answer.isCorrect ? '' : ` | Correct: ${answer.correctAnswer}`}`);
        });
        doc.moveDown(0.3);
      });
    });

    doc.end();
  } catch (err) {
    res.status(500).json({ message: 'Failed to export PDF report', error: err.message });
  }
};
