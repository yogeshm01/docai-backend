import express from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { uploadDocument, getDocuments, askQuestion, deleteDocument } from '../controllers/documentController.js';

const router = express.Router();
import path from 'path';

// Preserve original extension so downstream extractors can infer type
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'src/uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-z0-9-_]+/gi, '_')
      .slice(0, 80);
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});
const upload = multer({ storage });

router.get('/', authMiddleware, getDocuments);
router.post('/', authMiddleware, upload.single('file'), uploadDocument);
router.post('/:id/ask', authMiddleware, askQuestion);
router.delete('/:id', authMiddleware, deleteDocument);

export default router;
