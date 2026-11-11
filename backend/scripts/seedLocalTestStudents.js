import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import { ASH_TEST_TEACHER_ID } from '../utils/localTestAccounts.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(directory, '../.env') });
if (process.env.NODE_ENV !== 'development') throw new Error('Local test accounts can only be seeded with NODE_ENV=development.');
if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing from backend/.env');

const definitions = [
  { name: 'MarkOne Test User 1', registerNumber: '12100', className: '12A1' },
  { name: 'MarkOne Test User 2', registerNumber: '12200', className: '12A2' },
];

try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  const ashTeachers = await Teacher.find({ teacherId: ASH_TEST_TEACHER_ID, isActive: true }).select('_id').lean();
  if (ashTeachers.length !== 1) throw new Error(`Expected one active ASH teacher (${ASH_TEST_TEACHER_ID}); found ${ashTeachers.length}.`);

  const officialCollisions = await Student.countDocuments({
    isOfficial: true,
    $or: definitions.map(({ className, registerNumber }) => ({ className, registerNumber })),
  });
  if (officialCollisions) throw new Error('A reserved test register number is already assigned to an official student; no accounts were seeded.');

  const indexes = await Student.collection.indexes();
  const rosterIndex = indexes.find((index) => index.key?.className === 1
    && index.key?.registerNumber === 1 && index.key?.isTestAccount === 1);
  if (!rosterIndex) {
    await Student.collection.createIndex(
      { className: 1, registerNumber: 1, isTestAccount: 1 },
      { unique: true, partialFilterExpression: { isTestAccount: true } }
    );
  }
  const identityIndex = indexes.find((index) => index.key?.class === 1
    && index.key?.rollNumber === 1 && index.key?.isOfficial === 1 && index.key?.isTestAccount === 1);
  if (!identityIndex) {
    await Student.collection.createIndex({ class: 1, rollNumber: 1, isOfficial: 1, isTestAccount: 1 }, { unique: true });
  }
  for (const oldIdentityIndex of indexes.filter((index) => index.key?.class === 1
    && index.key?.rollNumber === 1 && index.key?.isOfficial === 1 && !index.key?.isTestAccount)) {
    await Student.collection.dropIndex(oldIdentityIndex.name);
  }
  const operations = definitions.map(({ name, registerNumber, className }) => ({
    updateOne: {
      filter: { className, registerNumber, isTestAccount: true },
      update: { $setOnInsert: {
        name,
        rollNumber: registerNumber,
        registerNumber,
        className,
        isOfficial: false,
        isActive: true,
        isTestAccount: true,
        joinedAt: null,
        dashboardStartedAt: null,
      } },
      upsert: true,
    },
  }));
  const result = await Student.bulkWrite(operations, { ordered: true });
  console.log(`Local test student setup complete: ${result.upsertedCount} inserted, ${result.matchedCount} already present.`);
} finally {
  await mongoose.disconnect();
}
