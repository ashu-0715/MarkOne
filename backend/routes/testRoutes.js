import express from 'express';
import { createTest, publishTest, getMyTests, getAvailableTestsForStudent, getTestForStudent, submitTestAttempt, getMyAttemptResult, downloadMyAttemptReport } from '../controllers/testController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/', protect(['teacher']), createTest);
router.patch('/:id/publish', protect(['teacher']), publishTest);
router.get('/mine', protect(['teacher']), getMyTests);

router.get('/available', protect(['student']), getAvailableTestsForStudent);
router.get('/:id/take', protect(['student']), getTestForStudent);
router.post('/:id/submit', protect(['student']), submitTestAttempt);
router.get('/:id/result', protect(['student']), getMyAttemptResult);
router.get('/:id/report/pdf', protect(['student']), downloadMyAttemptReport);

export default router;
