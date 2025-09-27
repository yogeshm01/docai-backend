import express from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { uploadDocument, getDocuments, askQuestion } from '../controllers/documentController.js';

const router = express.Router();
const upload = multer({ dest: 'src/uploads/' });

router.get('/', authMiddleware, getDocuments);
router.post('/', authMiddleware, upload.single('file'), uploadDocument);
router.post('/:id/ask', authMiddleware, askQuestion);

export default router;
