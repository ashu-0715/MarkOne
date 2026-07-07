import jwt from 'jsonwebtoken';
import Teacher from '../models/Teacher.js';
import Student from '../models/Student.js';

// Verifies JWT and attaches the authenticated principal to req.user
export const protect = (allowedRoles = ['teacher', 'student']) => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Not authorized, no token provided' });
      }
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (!allowedRoles.includes(decoded.role)) {
        return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
      }

      if (decoded.role === 'teacher') {
        const teacher = await Teacher.findById(decoded.id);
        if (!teacher || !teacher.isActive) {
          return res.status(401).json({ message: 'Account not found or deactivated' });
        }
        req.user = teacher;
      } else {
        const student = await Student.findById(decoded.id);
        if (!student || !student.isActive) {
          return res.status(401).json({ message: 'Account not found or deactivated' });
        }
        req.user = student;
      }
      req.role = decoded.role;
      next();
    } catch (err) {
      return res.status(401).json({ message: 'Not authorized, invalid or expired token' });
    }
  };
};

// Ensures a teacher can only ever touch their own resources (data isolation between teachers)
export const ensureOwnership = (resourceTeacherField = 'teacher') => {
  return (resource, req) => {
    return resource[resourceTeacherField]?.toString() === req.user._id.toString();
  };
};
