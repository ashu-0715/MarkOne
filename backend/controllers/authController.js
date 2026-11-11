import jwt from 'jsonwebtoken';
import Teacher from '../models/Teacher.js';
import Student from '../models/Student.js';
import ClassModel from '../models/Class.js';
import SystemSetting from '../models/SystemSetting.js';
import { generateTeacherId } from '../utils/generateId.js';
import { generateOtp, sendOtpSms } from '../utils/otp.js';
import { isLocalDevelopmentRequest } from '../utils/localTestAccounts.js';

const signToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// ---------- TEACHER ----------

export const registerTeacher = async (req, res) => {
  try {
    const { fullName, institution, mobile, email, subjects, classesHandling, password } = req.body;

    const existing = await Teacher.findOne({ mobile });
    if (existing) return res.status(409).json({ message: 'Mobile number already registered' });

    let teacherId;
    do {
      teacherId = generateTeacherId();
    } while (await Teacher.findOne({ teacherId }));

    const otp = generateOtp();
    const teacher = await Teacher.create({
      teacherId,
      fullName,
      institution,
      mobile,
      email,
      subjects,
      classesHandling,
      password,
      otp: { code: otp, expiresAt: Date.now() + 10 * 60 * 1000 },
    });

    await sendOtpSms(mobile, otp);

    res.status(201).json({
      message: 'Registration successful. Enter the OTP sent to your mobile to verify.',
      teacherId: teacher.teacherId,
    });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
};

export const verifyTeacherOtp = async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    const teacher = await Teacher.findOne({ mobile }).select('+otp');
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
    if (!teacher.otp?.code || teacher.otp.code !== otp || teacher.otp.expiresAt < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    teacher.mobileVerified = true;
    teacher.otp = undefined;
    await teacher.save();

    const token = signToken(teacher._id, 'teacher');
    res.json({ message: 'Mobile verified', token, teacher });
  } catch (err) {
    res.status(500).json({ message: 'Verification failed', error: err.message });
  }
};

export const loginTeacher = async (req, res) => {
  try {
    const { teacherName, subject, uniqueId, identifier, password } = req.body;
    const allowedTeacherIds = ['ASH2007', 'Ravi1983', 'Bala2026'];

    if (uniqueId) {
      const trimmedName = teacherName?.trim();
      const trimmedSubject = subject?.trim();
      const trimmedUniqueId = uniqueId.trim();

      if (!trimmedName || !trimmedSubject) {
        return res.status(400).json({ message: 'Teacher name and subject are required' });
      }

      if (!allowedTeacherIds.includes(trimmedUniqueId)) {
        return res.status(401).json({ message: 'Invalid admin unique ID' });
      }

      let teacher = await Teacher.findOne({ teacherId: trimmedUniqueId });
      if (!teacher) {
        teacher = await Teacher.create({
          teacherId: trimmedUniqueId,
          fullName: trimmedName,
          institution: 'Admin Approved',
          mobile: `admin-${trimmedUniqueId}`,
          subjects: [trimmedSubject],
          classesHandling: [],
          password: `${trimmedUniqueId}-default`,
          mobileVerified: true,
        });
      } else {
        teacher.fullName = trimmedName;
        teacher.subjects = [trimmedSubject];
        teacher.mobileVerified = true;
        await teacher.save();
      }

      if (!teacher.isActive) return res.status(403).json({ message: 'Account deactivated' });

      const token = signToken(teacher._id, 'teacher');
      return res.json({ message: 'Login successful', token, teacher });
    }

    const teacher = await Teacher.findOne({
      $or: [{ teacherId: identifier }, { mobile: identifier }],
    }).select('+password');

    if (!teacher || !(await teacher.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (!teacher.isActive) return res.status(403).json({ message: 'Account deactivated' });

    const token = signToken(teacher._id, 'teacher');
    res.json({ message: 'Login successful', token, teacher });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};

// ---------- STUDENT ----------
// Passwordless by design: students authenticate purely via a valid class code + roll number

export const getOfficialStudentRoster = async (req, res) => {
  try {
    const { className } = req.query;
    if (!['12A1', '12A2'].includes(className)) return res.status(400).json({ message: 'Select a valid class' });
    const students = await Student.find({ className, isOfficial: true, isActive: true, isTestAccount: false })
      .select('name registerNumber')
      .sort({ registerNumber: 1 })
      .lean();

    const testStudents = isLocalDevelopmentRequest(req)
      ? await Student.find({ className, isTestAccount: true, isActive: true })
        .select('name registerNumber')
        .lean()
      : [];
    res.json({ students: [...students, ...testStudents].sort((a, b) => a.registerNumber.localeCompare(b.registerNumber)) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch student roster', error: err.message });
  }
};

export const joinAsStudent = async (req, res) => {
  try {
    const { className, registerNumber, classCode } = req.body;
    if (!['12A1', '12A2'].includes(className) || typeof registerNumber !== 'string' || !registerNumber.trim()) {
      return res.status(400).json({ message: 'Select a valid class and register number' });
    }

    const normalizedCode = typeof classCode === 'string' ? classCode.trim().toUpperCase() : '';
    const classDoc = await ClassModel.findOne({ classCode: normalizedCode, isActive: true });
    if (!classDoc) return res.status(404).json({ message: 'Invalid class code' });

    let student = await Student.findOne({
      className,
      registerNumber: registerNumber.trim(),
      isOfficial: true,
      isActive: true,
      isTestAccount: false,
    });
    if (!student) {
      const testStudent = await Student.findOne({
        className,
        registerNumber: registerNumber.trim(),
        isTestAccount: true,
        isActive: true,
      });
      if (!testStudent) return res.status(404).json({ message: 'Official student not found or inactive' });
      if (!isLocalDevelopmentRequest(req)) return res.status(403).json({ message: 'Test accounts are available only from local development' });
      student = testStudent;
    }

    const isTestAccount = student.isTestAccount === true;
    const alreadyJoinedToClass = student.joinedAt
      && student.class?.toString() === classDoc._id.toString()
      && student.teacher?.toString() === classDoc.teacher.toString();

    if (!alreadyJoinedToClass) {
      const previousClassId = student.class;
      const hadPreviousOfficialClass = !isTestAccount && Boolean(student.joinedAt && previousClassId);
      const update = { class: classDoc._id, teacher: classDoc.teacher, rollNumber: student.registerNumber };
      if (!student.joinedAt) update.joinedAt = new Date();
      const joinedStudent = await Student.findOneAndUpdate(
        { _id: student._id },
        { $set: update },
        { new: true }
      );
      if (joinedStudent) {
        if (hadPreviousOfficialClass && previousClassId.toString() !== classDoc._id.toString()) {
          await ClassModel.updateOne(
            { _id: previousClassId, studentCount: { $gt: 0 } },
            { $inc: { studentCount: -1 } }
          );
        }
        if (!isTestAccount && (!hadPreviousOfficialClass || previousClassId.toString() !== classDoc._id.toString())) {
          await ClassModel.updateOne({ _id: classDoc._id }, { $inc: { studentCount: 1 } });
        }
        Object.assign(student, joinedStudent.toObject());
      } else {
        const current = await Student.findById(student._id);
        Object.assign(student, current.toObject());
      }
    }

    const token = signToken(student._id, 'student');
    res.status(200).json({ message: 'Joined successfully', token, student: student.toJSON() });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Roll number already used in this class' });
    }
    res.status(500).json({ message: 'Join failed', error: err.message });
  }
};
