import express from 'express';
import { body } from 'express-validator';
import { registerTeacher, verifyTeacherOtp, loginTeacher, joinAsStudent } from '../controllers/authController.js';
import { authLimiter, loginLimiter, studentJoinLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

router.post(
  '/teacher/register',
  authLimiter,
  [
    body('fullName').trim().notEmpty(),
    body('institution').trim().notEmpty(),
    body('mobile').trim().isMobilePhone('any'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validate,
  registerTeacher
);

router.post('/teacher/verify-otp', authLimiter, verifyTeacherOtp);
router.post('/teacher/login', loginLimiter, loginTeacher);

router.post(
  '/student/join',
  studentJoinLimiter,
  [
    body('name').trim().notEmpty(),
    body('rollNumber').trim().notEmpty(),
    body('className').trim().notEmpty(),
    body('section').trim().notEmpty(),
    body('classCode').trim().notEmpty(),
  ],
  validate,
  joinAsStudent
);

export default router;
