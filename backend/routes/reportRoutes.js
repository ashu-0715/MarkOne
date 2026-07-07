import express from 'express';
import {
  getClassReport,
  getStudentReport,
  getQuestionAnalysis,
  exportClassReportExcel,
  exportClassReportPdf,
} from '../controllers/reportController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect(['teacher']));
router.get('/class/:classId', getClassReport);
router.get('/student/:studentId', getStudentReport);
router.get('/question-analysis/:testId', getQuestionAnalysis);
router.get('/class/:classId/export/excel', exportClassReportExcel);
router.get('/class/:classId/export/pdf', exportClassReportPdf);

export default router;
