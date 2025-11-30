import express from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  getDocuments,
  getDocumentById,
  uploadDocument,
  duplicateDocument,
  askQuestion,
  updateDocumentMetadata,
  updateDocumentFile,
  deleteDocument,
  bulkDeleteDocuments,
} from '../controllers/documentController.js';

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


router.get('/', authMiddleware, getDocuments);                 // READ #1
router.get('/:id', authMiddleware, getDocumentById);           // READ #2

router.post('/', authMiddleware, upload.single('file'), uploadDocument);      // CREATE #1
router.post('/:id/duplicate', authMiddleware, duplicateDocument);             // CREATE #2

router.post('/:id/ask', authMiddleware, askQuestion);          // extra feature, not CRUD

router.patch('/:id', authMiddleware, updateDocumentMetadata);  // UPDATE #1
router.patch('/:id/file', authMiddleware, upload.single('file'), updateDocumentFile); // UPDATE #2

router.delete('/:id', authMiddleware, deleteDocument);         // DELETE #1
router.delete('/', authMiddleware, bulkDeleteDocuments);       // DELETE #2 (bulk)


export default router;
