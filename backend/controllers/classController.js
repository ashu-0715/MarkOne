import ClassModel from '../models/Class.js';
import Student from '../models/Student.js';
import { ASH_TEST_TEACHER_ID, classBelongsToAshTeacher, isLocalDevelopmentRequest } from '../utils/localTestAccounts.js';
import { getRosterClassName } from '../utils/classRoster.js';

const normalizeClassCode = (value) => value?.trim().toUpperCase();

export const createClass = async (req, res) => {
  try {
    const { name, subject, classCode } = req.body;
    const normalizedClassCode = normalizeClassCode(classCode);

    if (!normalizedClassCode) {
      return res.status(400).json({ message: 'Class code is required' });
    }

    const existingClass = await ClassModel.findOne({ classCode: normalizedClassCode });
    if (existingClass) {
      return res.status(409).json({ message: 'Class code already exists. Choose another code.' });
    }

    const newClass = await ClassModel.create({
      name,
      subject,
      classCode: normalizedClassCode,
      teacher: req.user._id,
    });

    res.status(201).json({ message: 'Class created', class: newClass });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create class', error: err.message });
  }
};

export const getMyClasses = async (req, res) => {
  try {
    const classes = await ClassModel.find({ teacher: req.user._id, isActive: true }).sort({ createdAt: -1 }).lean();
    if (!classes.length) return res.json({ classes });
    const rosterPairs = classes.map((classDoc) => ({
      class: classDoc._id,
      ...(getRosterClassName(classDoc) ? { className: getRosterClassName(classDoc) } : {}),
    }));
    const [counts, localTestStudents] = await Promise.all([
      Student.aggregate([
        { $match: {
          teacher: req.user._id,
          isOfficial: true,
          isActive: true,
          isTestAccount: false,
          joinedAt: { $ne: null },
          $or: rosterPairs,
        } },
        { $group: { _id: '$class', count: { $sum: 1 } } },
      ]),
      process.env.NODE_ENV === 'development'
        && req.user.teacherId === ASH_TEST_TEACHER_ID
        && isLocalDevelopmentRequest(req)
        ? Student.find({
          teacher: req.user._id,
          $or: rosterPairs,
          isTestAccount: true,
          isActive: true,
        }).select('name registerNumber class className').lean()
        : [],
    ]);
    const countByClass = new Map(counts.map(({ _id, count }) => [_id.toString(), count]));
    localTestStudents.forEach((student) => {
      const classId = student.class.toString();
      countByClass.set(classId, (countByClass.get(classId) || 0) + 1);
    });
    classes.forEach((classDoc) => {
      classDoc.studentCount = countByClass.get(classDoc._id.toString()) || 0;
      classDoc.localTestStudents = localTestStudents
        .filter((student) => student.class.toString() === classDoc._id.toString())
        .map(({ name, registerNumber }) => ({ name, registerNumber }));
    });
    res.json({ classes });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch classes', error: err.message });
  }
};

export const updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subject, classCode } = req.body;
    const update = { name, subject };

    if (classCode !== undefined) {
      const normalizedClassCode = normalizeClassCode(classCode);
      if (!normalizedClassCode) {
        return res.status(400).json({ message: 'Class code is required' });
      }

      const existingClass = await ClassModel.findOne({
        classCode: normalizedClassCode,
        _id: { $ne: id },
      });
      if (existingClass) {
        return res.status(409).json({ message: 'Class code already exists. Choose another code.' });
      }

      update.classCode = normalizedClassCode;
    }

    const updatedClass = await ClassModel.findOneAndUpdate(
      { _id: id, teacher: req.user._id, isActive: true },
      update,
      { new: true, runValidators: true }
    );

    if (!updatedClass) {
      return res.status(404).json({ message: 'Class not found' });
    }

    res.json({ message: 'Class updated', class: updatedClass });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update class', error: err.message });
  }
};

export const deleteClass = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedClass = await ClassModel.findOneAndUpdate(
      { _id: id, teacher: req.user._id, isActive: true },
      { isActive: false },
      { new: true }
    );

    if (!deletedClass) {
      return res.status(404).json({ message: 'Class not found' });
    }

    res.json({ message: 'Class deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete class', error: err.message });
  }
};

// Paginated so a class of 500+ students never loads in one giant payload
export const getClassStudents = async (req, res) => {
  try {
    const { id } = req.params;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    const classDoc = await ClassModel.findOne({ _id: id, teacher: req.user._id, isActive: true });
    if (!classDoc) return res.status(404).json({ message: 'Class not found' });

    const studentFilter = { class: id };
    if (!(process.env.NODE_ENV === 'development'
      && req.user.teacherId === ASH_TEST_TEACHER_ID
      && isLocalDevelopmentRequest(req)
      && await classBelongsToAshTeacher(classDoc))) {
      studentFilter.isTestAccount = { $ne: true };
    }
    const rosterClassName = getRosterClassName(classDoc);
    if (rosterClassName) studentFilter.className = rosterClassName;

    const [students, total] = await Promise.all([
      Student.find(studentFilter)
        .sort({ rollNumber: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Student.countDocuments(studentFilter),
    ]);

    res.json({ students, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch students', error: err.message });
  }
};
