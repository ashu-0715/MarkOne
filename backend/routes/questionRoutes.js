import express from 'express';
import {
  createQuestion,
  updateQuestion,
  deleteQuestions,
  getQuestionBank,
  parsePastedQuestions,
  generateFromLesson,
  generateFromPrompt,
  getQuestionSets,
  createQuestionSet,
  updateQuestionSet,
  deleteQuestionSet,
  assignQuestionsToSet,
} from '../controllers/questionController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect(['teacher']));
router.get('/sets', getQuestionSets);
router.post('/sets', createQuestionSet);
router.put('/sets/:id', updateQuestionSet);
router.delete('/sets/:id', deleteQuestionSet);
router.patch('/assign-set', assignQuestionsToSet);
router.get('/', getQuestionBank);
router.post('/', createQuestion);
router.put('/:id', updateQuestion);
router.delete('/', deleteQuestions); // bulk delete via { ids: [...] } in body
router.post('/parse-pasted', parsePastedQuestions);
router.post('/generate/lesson', generateFromLesson);
router.post('/generate/prompt', generateFromPrompt);

export default router;
