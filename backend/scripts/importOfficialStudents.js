import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Student from '../models/Student.js';
import SystemSetting from '../models/SystemSetting.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(directory, '../.env') });

const parseCsv = (text) => {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { field += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(field); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...data] = rows;
  if (header?.join(',').replace(/^\uFEFF/, '').toLowerCase() !== 'name,registernumber,classname') throw new Error('CSV must have columns name,registerNumber,className');
  return data.map(([name, registerNumber, className]) => ({
    name: name?.trim(), registerNumber: registerNumber?.trim(), className: className?.trim(),
  }));
};

const csvPath = process.argv[2];
if (!csvPath) throw new Error('Pass the official CSV path as the first argument.');
if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing from backend/.env');

const students = parseCsv(await readFile(csvPath, 'utf8'));
const counts = students.reduce((result, student) => {
  result[student.className] = (result[student.className] || 0) + 1;
  return result;
}, {});
if (students.length !== 124 || counts['12A1'] !== 61 || counts['12A2'] !== 63) {
  throw new Error(`CSV roster validation failed (${students.length} total, ${counts['12A1'] || 0} in 12A1, ${counts['12A2'] || 0} in 12A2).`);
}
if (students.some((student) => !student.name || !/^(?:121|122)\d{2}$/.test(student.registerNumber) || !['12A1', '12A2'].includes(student.className)
  || (student.className === '12A1' && !student.registerNumber.startsWith('121'))
  || (student.className === '12A2' && !student.registerNumber.startsWith('122')))) {
  throw new Error('CSV contains an invalid name, register number, or class.');
}
if (new Set(students.map(({ className, registerNumber }) => `${className}:${registerNumber}`)).size !== students.length) {
  throw new Error('CSV contains duplicate class and register number pairs.');
}

try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  const studentsCollectionExists = await mongoose.connection.db
    .listCollections({ name: Student.collection.collectionName }, { nameOnly: true })
    .hasNext();
  if (!studentsCollectionExists) await Student.createCollection();
  const currentIndexes = await Student.collection.indexes();
  const classRollIndex = currentIndexes.find((index) => index.key?.class === 1 && index.key?.rollNumber === 1);
  if (classRollIndex && !classRollIndex.unique) {
    throw new Error('Existing class/roll index is not unique; no student records were imported.');
  }
  await Student.updateMany({ isOfficial: { $exists: false } }, { $set: { isOfficial: false } });
  if (classRollIndex && !classRollIndex.key?.isOfficial) {
    await Student.collection.dropIndex(classRollIndex.name);
  }
  const identityIndex = currentIndexes.find((index) => index.key?.class === 1 && index.key?.rollNumber === 1 && index.key?.isOfficial === 1);
  if (!identityIndex) await Student.collection.createIndex({ class: 1, rollNumber: 1, isOfficial: 1 }, { unique: true });
  const officialIndex = currentIndexes.find((index) => index.key?.className === 1 && index.key?.registerNumber === 1);
  if (!officialIndex) {
    await Student.collection.createIndex(
      { className: 1, registerNumber: 1 },
      { unique: true, partialFilterExpression: { isOfficial: true, registerNumber: { $type: 'string' } } }
    );
  } else if (!officialIndex.unique || officialIndex.partialFilterExpression?.isOfficial !== true) {
    throw new Error('Existing official-student index has incompatible options; no student records were imported.');
  }
  const operations = students.map(({ name, registerNumber, className }) => ({
    updateOne: {
      filter: { className, registerNumber, isOfficial: true },
      update: { $setOnInsert: {
        name, rollNumber: registerNumber, registerNumber, className,
        isOfficial: true, isActive: true, isTestAccount: false, joinedAt: null,
      } },
      upsert: true,
    },
  }));
  const result = await Student.bulkWrite(operations, { ordered: true });
  await SystemSetting.updateOne(
    { key: 'student-system' },
    { $setOnInsert: { studentSystemActivatedAt: new Date() } },
    { upsert: true }
  );
  console.log(`Official roster import complete: ${students.length} records checked; ${result.upsertedCount} inserted, ${result.matchedCount} already present.`);
  console.log('Student system activation time was initialized only if it did not already exist.');
} finally {
  await mongoose.disconnect();
}
