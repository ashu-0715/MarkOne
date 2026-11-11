import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Student from '../models/Student.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(directory, '../.env') });
if (!process.env.MONGO_URI || !process.env.JWT_SECRET) throw new Error('Backend database or token configuration is missing.');

try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  const student = await Student.findOne({ name: 'AYYAPPAN E', className: '12A1', registerNumber: '12130', isOfficial: true, isTestAccount: false }).select('_id');
  if (!student) throw new Error('Official student was not found.');
  const token = jwt.sign({ id: student._id, role: 'student' }, process.env.JWT_SECRET, { expiresIn: '1m' });
  const headers = { Authorization: `Bearer ${token}` };
  const [availableResponse, historyResponse] = await Promise.all([
    fetch('http://localhost:5000/api/tests/available', { headers }),
    fetch('http://localhost:5000/api/tests/history', { headers }),
  ]);
  const [available, history] = await Promise.all([availableResponse.json(), historyResponse.json()]);
  console.log(JSON.stringify({
    availableStatus: availableResponse.status,
    availableCount: available.tests?.length,
    resultHistoryStatus: historyResponse.status,
    resultHistoryCount: history.attempts?.length,
  }));
} finally {
  await mongoose.disconnect();
}
