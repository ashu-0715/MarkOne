import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Student from '../models/Student.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(directory, '../.env') });
if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing from backend/.env');

try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  const result = await Student.updateOne(
    { name: 'AYYAPPAN E', className: '12A1', registerNumber: '12130', isOfficial: true, isTestAccount: false },
    { $set: { dashboardStartedAt: new Date() } }
  );
  if (result.matchedCount !== 1) throw new Error(`Expected one official student; matched ${result.matchedCount}. No dashboard reset was applied.`);
  console.log('Student dashboard history boundary reset. Historical attempts and teacher reports were not modified.');
} finally {
  await mongoose.disconnect();
}
