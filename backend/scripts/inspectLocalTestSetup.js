import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import Class from '../models/Class.js';
import { ASH_TEST_TEACHER_ID, classMatchesStudentClass } from '../utils/localTestAccounts.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(directory, '../.env') });
if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing from backend/.env');

try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  const teachers = await Teacher.find({ teacherId: 'ASH2007' }).select('teacherId fullName isActive').lean();
  const [classes, activeClasses, testAccountCount, reservedNumberCount] = await Promise.all([
    teachers[0] ? Class.find({ teacher: teachers[0]._id }).select('name classCode isActive').lean() : [],
    Class.find({ isActive: true }).select('name classCode teacher').populate('teacher', 'teacherId').lean(),
    Student.countDocuments({ isTestAccount: true }),
    Student.countDocuments({ registerNumber: { $in: ['12100', '12200'] } }),
  ]);
  console.log(JSON.stringify({
    databaseType: /^(localhost|127\.0\.0\.1|::1)(:|$)/i.test(mongoose.connection.host) ? 'local' : 'remote',
    nodeEnvironment: process.env.NODE_ENV || 'unset',
    ashTeacherMatches: teachers.length,
    ashTeacherId: teachers[0]?.teacherId || null,
    ashTeacherName: teachers[0]?.fullName || null,
    ashTeacherActive: teachers[0]?.isActive || false,
    ashClassCount: classes.length,
    ashClasses: classes.map(({ name, classCode, isActive }) => ({ name, classCode, isActive })),
    otherTeacherClassCodes: activeClasses
      .filter((classDoc) => classDoc.teacher?.teacherId !== ASH_TEST_TEACHER_ID)
      .filter((classDoc) => classMatchesStudentClass(classDoc, '12A1') || classMatchesStudentClass(classDoc, '12A2'))
      .map(({ name, classCode, teacher }) => ({ name, classCode, teacherId: teacher?.teacherId || null })),
    existingTestAccountCount: testAccountCount,
    reservedRegisterNumberCount: reservedNumberCount,
  }, null, 2));
} finally {
  await mongoose.disconnect();
}
