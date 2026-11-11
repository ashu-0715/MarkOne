import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Class from '../models/Class.js';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import { ASH_TEST_TEACHER_ID } from '../utils/localTestAccounts.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(directory, '../.env') });
if (!process.env.MONGO_URI || !process.env.JWT_SECRET) throw new Error('Backend database or token configuration is missing.');

const requestHeaders = { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' };
const loginTestStudent = async (classCode) => {
  const response = await fetch('http://127.0.0.1:5000/api/auth/student/join', {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify({ className: '12A1', registerNumber: '12100', classCode }),
  });
  if (!response.ok) throw new Error(`Test login failed for ${classCode} (${response.status}).`);
  return response.json();
};

try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  const [otherTeacherClass, ashTeacher] = await Promise.all([
    Class.findOne({ classCode: 'PHY12A1', isActive: true }).populate('teacher', 'teacherId').lean(),
    Teacher.findOne({ teacherId: ASH_TEST_TEACHER_ID, isActive: true }).select('_id').lean(),
  ]);
  if (!otherTeacherClass?.teacher || otherTeacherClass.teacher.teacherId === ASH_TEST_TEACHER_ID || !ashTeacher) {
    throw new Error('Expected active 12A1 classes for ASH and a different teacher.');
  }
  try {
    await loginTestStudent(otherTeacherClass.classCode);
    const teacherToken = jwt.sign({ id: otherTeacherClass.teacher._id, role: 'teacher' }, process.env.JWT_SECRET, { expiresIn: '1m' });
    const headers = { Authorization: `Bearer ${teacherToken}`, Origin: 'http://localhost:5173' };
    const [studentsResponse, reportResponse, classesResponse] = await Promise.all([
      fetch(`http://127.0.0.1:5000/api/classes/${otherTeacherClass._id}/students?limit=100`, { headers }),
      fetch(`http://127.0.0.1:5000/api/reports/class/${otherTeacherClass._id}`, { headers }),
      fetch('http://127.0.0.1:5000/api/classes', { headers }),
    ]);
    const [roster, report, dashboard] = await Promise.all([
      studentsResponse.json(), reportResponse.json(), classesResponse.json(),
    ]);
    const dashboardClass = dashboard.classes?.find((entry) => entry.classCode === otherTeacherClass.classCode);
    console.log(JSON.stringify({
      nonAshLoginStatus: 200,
      rosterStatus: studentsResponse.status,
      reportStatus: reportResponse.status,
      dashboardStatus: classesResponse.status,
      nonAshRosterHasTestAccount: (roster.students || []).some((student) => student.isTestAccount || student.name?.startsWith('MarkOne Test User')),
      nonAshReportHasTestAccount: (report.analysis?.students || []).some((entry) => entry.student?.isTestAccount || entry.student?.name?.startsWith('MarkOne Test User')),
      nonAshDashboardStudentCount: dashboardClass?.studentCount ?? null,
      nonAshDashboardHasLocalTestAccount: (dashboardClass?.localTestStudents || []).some((student) => student.name?.startsWith('MarkOne Test User')),
    }));
  } finally {
    await loginTestStudent('TAM12A1');
  }
} finally {
  await mongoose.disconnect();
}
