import ClassModel from '../models/Class.js';
import Student from '../models/Student.js';
import { generateClassCode } from '../utils/generateId.js';

export const createClass = async (req, res) => {
  try {
    const { name, subject, className, section } = req.body;

    let classCode;
    do {
      classCode = generateClassCode(subject, className, section);
    } while (await ClassModel.findOne({ classCode }));

    const newClass = await ClassModel.create({
      name,
      subject,
      classCode,
      teacher: req.user._id,
    });

    res.status(201).json({ message: 'Class created', class: newClass });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create class', error: err.message });
  }
};

export const getMyClasses = async (req, res) => {
  try {
    const classes = await ClassModel.find({ teacher: req.user._id, isActive: true }).sort({ createdAt: -1 });
    res.json({ classes });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch classes', error: err.message });
  }
};

export const updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subject } = req.body;

    const updatedClass = await ClassModel.findOneAndUpdate(
      { _id: id, teacher: req.user._id, isActive: true },
      { name, subject },
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

    const classDoc = await ClassModel.findOne({ _id: id, teacher: req.user._id });
    if (!classDoc) return res.status(404).json({ message: 'Class not found' });

    const [students, total] = await Promise.all([
      Student.find({ class: id })
        .sort({ rollNumber: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Student.countDocuments({ class: id }),
    ]);

    res.json({ students, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch students', error: err.message });
  }
};
