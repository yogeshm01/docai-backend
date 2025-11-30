// src/controllers/documentController.js
import fs from 'fs';
import fetch from 'node-fetch';
import { prisma } from '../prismaClient.js';
import { extractText } from '../services/extractText.js';
import path from 'path';

// ------------------------------------------- GET DOCUMENTS -------------------------------------------
export async function getDocuments(req, res) {
  try {
    const userId = req.query.userId ? Number(req.query.userId) : undefined;

    const where = userId ? { userId } : {}; // if no userId, return all
    const docs = await prisma.document.findMany({ where });
    res.json(docs);
  } catch (err) {
    console.error('getDocuments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ------------------------------------------- GET DOCUMENT BY ID -------------------------------------------
export async function getDocumentById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid document id' });
    }

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Optional: if you only want owner to see it
    // if (!req.user || req.user.id !== doc.userId) {
    //   return res.status(403).json({ error: 'Not allowed to view this document' });
    // }

    return res.json(doc);
  } catch (err) {
    console.error('getDocumentById error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// ------------------------------------------- DUPLICATE DOCUMENT -------------------------------------------
export async function duplicateDocument(req, res) {
  try {
    const sourceId = Number(req.params.id);
    if (!Number.isFinite(sourceId)) {
      return res.status(400).json({ error: 'Invalid document id' });
    }

    const sourceDoc = await prisma.document.findUnique({ where: { id: sourceId } });
    if (!sourceDoc) {
      return res.status(404).json({ error: 'Source document not found' });
    }

    // Ownership check – only owner can duplicate
    if (!req.user || req.user.id !== sourceDoc.userId) {
      return res.status(403).json({ error: 'Not allowed to duplicate this document' });
    }

    // Option A: reuse same filePath
    // Option B: actually copy the file on disk to a new filename (shown here)
    const oldPath = path.isAbsolute(sourceDoc.filePath)
      ? sourceDoc.filePath
      : path.resolve(sourceDoc.filePath);

    let newFilePath = sourceDoc.filePath;
    if (fs.existsSync(oldPath)) {
      const ext = path.extname(oldPath);
      const baseName = path.basename(oldPath, ext);
      const dirName = path.dirname(oldPath);
      const newName = `${baseName}_copy_${Date.now()}${ext}`;
      const newAbsPath = path.join(dirName, newName);

      fs.copyFileSync(oldPath, newAbsPath);

      // Store relative or absolute path according to your existing pattern
      newFilePath = newAbsPath;
    }

    const duplicated = await prisma.document.create({
      data: {
        title: sourceDoc.title + ' (copy)',
        filePath: newFilePath,
        userId: sourceDoc.userId,
      },
    });

    return res.status(201).json(duplicated);
  } catch (err) {
    console.error('duplicateDocument error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}


// ------------------------------------------- UPDATE DOCUMENT METADATA -------------------------------------------
export async function updateDocumentMetadata(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid document id' });
    }

    const { title } = req.body;
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Title is required and must be a string' });
    }

    const existing = await prisma.document.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Ownership check
    if (!req.user || req.user.id !== existing.userId) {
      return res.status(403).json({ error: 'Not allowed to update this document' });
    }

    const updated = await prisma.document.update({
      where: { id },
      data: { title },
    });

    return res.json(updated);
  } catch (err) {
    console.error('updateDocumentMetadata error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}


// ------------------------------------------- UPDATE DOCUMENT FILE -------------------------------------------
export async function updateDocumentFile(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid document id' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const existing = await prisma.document.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Ownership check
    if (!req.user || req.user.id !== existing.userId) {
      return res.status(403).json({ error: 'Not allowed to update this document file' });
    }

    // Remove old file if it exists
    try {
      const oldAbsolutePath = path.isAbsolute(existing.filePath)
        ? existing.filePath
        : path.resolve(existing.filePath);

      if (fs.existsSync(oldAbsolutePath)) {
        fs.unlinkSync(oldAbsolutePath);
      }
    } catch (e) {
      console.warn('updateDocumentFile: failed to remove old file', e);
    }

    const updated = await prisma.document.update({
      where: { id },
      data: {
        filePath: req.file.path,
      },
    });

    return res.json(updated);
  } catch (err) {
    console.error('updateDocumentFile error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}


// ------------------------------------------- DELETE DOCUMENT -------------------------------------------
export async function deleteDocument(req, res) {
  try {
    const { id } = req.params;
    const docId = Number(id);
    if (!Number.isFinite(docId)) return res.status(400).json({ error: 'Invalid document id' });

    const doc = await prisma.document.findUnique({ where: { id: docId } });
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Ownership check
    if (!req.user || req.user.id !== doc.userId) {
      return res.status(403).json({ error: 'Not allowed to delete this document' });
    }

    // Try to remove file from disk
    try {
      const absolutePath = path.isAbsolute(doc.filePath) ? doc.filePath : path.resolve(doc.filePath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    } catch (e) {
      // Log and proceed — we still delete DB record
      console.warn('deleteDocument: failed to remove file', e);
    }

    await prisma.document.delete({ where: { id: docId } });
    return res.status(204).send();
  } catch (err) {
    console.error('deleteDocument error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}


// ------------------------------------------- BULK DELETE DOCUMENTS -------------------------------------------
export async function bulkDeleteDocuments(req, res) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    const docIds = ids.map(Number).filter(Number.isFinite);
    if (docIds.length === 0) {
      return res.status(400).json({ error: 'No valid document ids provided' });
    }

    // Fetch documents to check ownership and clean up files
    const docs = await prisma.document.findMany({
      where: { id: { in: docIds } },
    });

    // Only allow deletion of docs owned by this user
    const ownedDocs = docs.filter(d => d.userId === req.user?.id);
    const ownedIds = ownedDocs.map(d => d.id);

    if (ownedIds.length === 0) {
      return res.status(403).json({ error: 'No documents owned by you in the given ids' });
    }

    // Delete files from disk
    for (const doc of ownedDocs) {
      try {
        const absolutePath = path.isAbsolute(doc.filePath)
          ? doc.filePath
          : path.resolve(doc.filePath);
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
        }
      } catch (e) {
        console.warn('bulkDeleteDocuments: failed to remove file for doc', doc.id, e);
      }
    }

    // Delete from DB
    await prisma.document.deleteMany({
      where: { id: { in: ownedIds } },
    });

    return res.status(204).send();
  } catch (err) {
    console.error('bulkDeleteDocuments error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}


// ------------------------------------------- UPLOAD DOCUMENT -------------------------------------------
export async function uploadDocument(req, res) {
  try {
    const { title, userId } = req.body;
    // if you want to require userId, uncomment:
    // if (!userId) return res.status(400).json({ error: 'userId is required' });

    if (!req.file) return res.status(400).json({ error: 'File required' });

    const ownerId = userId ? Number(userId) : null;

    const doc = await prisma.document.create({
      data: {
        title,
        filePath: req.file.path,
        userId: ownerId, // if nullable in DB; else require userId
      },
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error('uploadDocument error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}



// ------------------------------------------- ASK QUESTION -------------------------------------------
export async function askQuestion(req, res) {
  try {
    const { id } = req.params;
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'Question is required' });

    const document = await prisma.document.findUnique({ where: { id: Number(id) } });
    if (!document) return res.status(404).json({ error: 'Document not found' });

    // Resolve absolute path and validate the file before extraction
    const absolutePath = path.isAbsolute(document.filePath)
      ? document.filePath
      : path.resolve(document.filePath);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'File not found', path: absolutePath });
    }

    const stat = fs.statSync(absolutePath);
    if (!stat || stat.size === 0) {
      return res.status(422).json({ error: 'Uploaded file is empty' });
    }

    const text = await extractText(absolutePath);
    if (!text || !text.trim()) {
      return res.status(422).json({
        error: 'Unable to extract text. Ensure the document contains selectable text (not scanned images). If scanned, enable OCR or upload DOCX/PDF with text.'
      });
    }

    // Clip very large documents to reduce upstream errors and latency
    const MAX_CHARS = 20000;
    const clipped = text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}\n\n[...truncated...]` : text;
    const prompt = `Answer the question based on the following document:\n\n${clipped}\n\nQuestion: ${question}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }]
    };

    // Simple retry with timeout to handle transient TLS/network errors
    const requestOnce = () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      }).finally(() => clearTimeout(timeout));
    };

    let response;
    try {
      response = await requestOnce();
    } catch (e1) {
      // backoff and retry once
      await new Promise(r => setTimeout(r, 800));
      try {
        response = await requestOnce();
      } catch (e2) {
        return res.status(503).json({
          error: 'Upstream model is unreachable. Please try again shortly.',
          detail: String(e2?.message || e2)
        });
      }
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      return res.status(502).json({ error: 'Invalid response from model endpoint' });
    }
    if (!response.ok) return res.status(response.status).json({ error: data });

    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No answer';
    res.json({ answer });
  } catch (err) {
    console.error('askQuestion error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
