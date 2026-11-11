import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Student from '../models/Student.js';
import Test from '../models/Test.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(directory, '../.env') });
if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing from backend/.env');

try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  const students = await Student.find({ name: 'AYYAPPAN E', className: '12A1', registerNumber: '12130', isOfficial: true })
    .select('_id class joinedAt')
    .lean();
  const tests = students[0]?.class
    ? await Test.find({
      class: students[0].class,
      status: 'published',
      $or: [{ title: /tamil/i }, { subject: /tamil/i }],
    }).select('_id title subject createdAt availableFrom availableUntil hiddenForStudents').sort({ createdAt: -1 }).lean()
    : [];
  console.log(JSON.stringify({
    matchingOfficialStudents: students.length,
    joined: Boolean(students[0]?.joinedAt),
    matchingPublishedTamilTests: tests.map((test) => ({
      id: test._id,
      title: test.title,
      subject: test.subject,
      createdAt: test.createdAt,
      availableFrom: test.availableFrom,
      availableUntil: test.availableUntil,
      alreadyHidden: test.hiddenForStudents?.some((id) => id.toString() === students[0]._id.toString()) || false,
    })),
  }, null, 2));
} finally {
  await mongoose.disconnect();
}
