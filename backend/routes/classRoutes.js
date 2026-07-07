import express from 'express';
import { createClass, getMyClasses, getClassStudents } from '../controllers/classController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect(['teacher']));
router.post('/', createClass);
router.get('/', getMyClasses);
router.get('/:id/students', getClassStudents);

export default router;
