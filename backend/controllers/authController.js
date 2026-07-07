import jwt from 'jsonwebtoken';
import Teacher from '../models/Teacher.js';
import Student from '../models/Student.js';
import ClassModel from '../models/Class.js';
import { generateTeacherId } from '../utils/generateId.js';
import { generateOtp, sendOtpSms } from '../utils/otp.js';

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
    const allowedTeacherIds = ['ASH2007', 'Ravi1983'];

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

export const joinAsStudent = async (req, res) => {
  try {
    const { name, rollNumber, className, section, classCode } = req.body;

    const classDoc = await ClassModel.findOne({ classCode, isActive: true });
    if (!classDoc) return res.status(404).json({ message: 'Invalid class code' });

    let student = await Student.findOne({ class: classDoc._id, rollNumber });
    if (!student) {
      student = await Student.create({
        name,
        rollNumber,
        className,
        section,
        class: classDoc._id,
        teacher: classDoc.teacher,
      });
      classDoc.studentCount += 1;
      await classDoc.save();
    }

    const token = signToken(student._id, 'student');
    res.status(200).json({ message: 'Joined successfully', token, student });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Roll number already used in this class' });
    }
    res.status(500).json({ message: 'Join failed', error: err.message });
  }
};
