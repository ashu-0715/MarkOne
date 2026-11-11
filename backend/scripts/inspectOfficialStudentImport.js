import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Student from '../models/Student.js';
import SystemSetting from '../models/SystemSetting.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(directory, '../.env') });
if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing from backend/.env');

try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  const exists = await mongoose.connection.db.listCollections({ name: Student.collection.collectionName }, { nameOnly: true }).hasNext();
  const [historicalStudentCount, officialStudentCount, setting, indexes, duplicateGroups] = await Promise.all([
    Student.countDocuments({ isOfficial: { $ne: true } }),
    Student.countDocuments({ isOfficial: true }),
    SystemSetting.findOne({ key: 'student-system' }).select('studentSystemActivatedAt').lean(),
    exists ? Student.collection.indexes() : [],
    Student.aggregate([
      { $match: { isOfficial: true, registerNumber: { $type: 'string' } } },
      { $group: { _id: { className: '$className', registerNumber: '$registerNumber' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: 'groups' },
    ]),
  ]);

  console.log(JSON.stringify({
    databaseType: /^(localhost|127\.0\.0\.1|::1)(:|$)/i.test(mongoose.connection.host) ? 'local' : 'remote',
    studentCollectionExists: exists,
    historicalStudentCount,
    officialStudentCount,
    duplicateOfficialIdentityGroups: duplicateGroups[0]?.groups || 0,
    activationInitialized: Boolean(setting?.studentSystemActivatedAt),
    indexes: indexes.map(({ name, key, unique, partialFilterExpression }) => ({ name, key, unique, partialFilterExpression })),
  }, null, 2));
} finally {
  await mongoose.disconnect();
}
