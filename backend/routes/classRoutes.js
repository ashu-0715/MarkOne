import express from 'express';
import { createClass, deleteClass, getMyClasses, getClassStudents, updateClass } from '../controllers/classController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect(['teacher']));
router.post('/', createClass);
router.get('/', getMyClasses);
router.patch('/:id', updateClass);
router.delete('/:id', deleteClass);
router.get('/:id/students', getClassStudents);

export default router;
