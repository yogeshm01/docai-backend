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

// ------------------------------------------- MULTER CONFIG -------------------------------------------
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

// ------------------------------------------- ROUTES -------------------------------------------
router.get('/', authMiddleware, getDocuments);                  
router.get('/:id', authMiddleware, getDocumentById);           

router.post('/', authMiddleware, upload.single('file'), uploadDocument);      
router.post('/:id/duplicate', authMiddleware, duplicateDocument);             

router.post('/:id/ask', authMiddleware, askQuestion);          

router.patch('/:id', authMiddleware, updateDocumentMetadata);  
router.patch('/:id/file', authMiddleware, upload.single('file'), updateDocumentFile); 

router.delete('/:id', authMiddleware, deleteDocument);         
router.delete('/', authMiddleware, bulkDeleteDocuments);       


export default router;
