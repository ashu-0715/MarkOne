import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Class from '../models/Class.js';
import Teacher from '../models/Teacher.js';
import { ASH_TEST_TEACHER_ID } from '../utils/localTestAccounts.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(directory, '../.env') });
if (!process.env.MONGO_URI || !process.env.JWT_SECRET) throw new Error('Backend database or token configuration is missing.');

try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  const teacher = await Teacher.findOne({ teacherId: ASH_TEST_TEACHER_ID, isActive: true }).select('_id').lean();
  if (!teacher) throw new Error('Active ASH teacher was not found.');
  const classes = await Class.find({ teacher: teacher._id, classCode: { $in: ['TAM12A1', 'CHE2007'] }, isActive: true }).select('_id classCode').lean();
  const token = jwt.sign({ id: teacher._id, role: 'teacher' }, process.env.JWT_SECRET, { expiresIn: '1m' });
  const headers = { Authorization: `Bearer ${token}`, Origin: 'http://localhost:5173' };
  const results = [];
  for (const classDoc of classes) {
    const [rosterResponse, reportResponse, dashboardResponse] = await Promise.all([
      fetch(`http://127.0.0.1:5000/api/classes/${classDoc._id}/students?limit=100`, { headers }),
      fetch(`http://127.0.0.1:5000/api/reports/class/${classDoc._id}`, { headers }),
      fetch('http://127.0.0.1:5000/api/classes', { headers }),
    ]);
    const [roster, report, dashboard] = await Promise.all([
      rosterResponse.json(), reportResponse.json(), dashboardResponse.json(),
    ]);
    const classReport = report.analysis;
    const dashboardClass = dashboard.classes?.find((entry) => entry.classCode === classDoc.classCode);
    results.push({
      classCode: classDoc.classCode,
      rosterStatus: rosterResponse.status,
      reportStatus: reportResponse.status,
      dashboardStatus: dashboardResponse.status,
      classRosterHasTestAccount: (roster.students || []).some((student) => student.isTestAccount === true || student.name?.startsWith('MarkOne Test User')),
      reportHasTestAccount: (classReport?.students || []).some((entry) => entry.student?.isTestAccount === true || entry.student?.name?.startsWith('MarkOne Test User')),
      dashboardStudentCount: dashboardClass?.studentCount ?? null,
      dashboardHasLocalTestAccount: (dashboardClass?.localTestStudents || []).some((student) => student.name?.startsWith('MarkOne Test User')),
      reportAttemptCount: classReport?.summary?.totalAttempts ?? null,
    });
  }
  console.log(JSON.stringify(results));
} finally {
  await mongoose.disconnect();
}
