// src/controllers/documentController.js
import fs from 'fs';
import fetch from 'node-fetch';
import { prisma } from '../prismaClient.js';
import { extractText } from '../services/extractText.js';
import path from 'path';

/**
 * GET /api/documents?userId=123
 * If userId is provided, return documents for that user.
 * If not, return all documents (public).
 */
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

/**
 * DELETE /api/documents/:id
 * Requires auth; only the owner (req.user.id) can delete.
 * Removes the file from disk if present and deletes DB record.
 */
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
/**
 * POST /api/documents
 * Accepts form-data with 'title', 'file', and (optional) 'userId'
 */
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

    res.json(doc);
  } catch (err) {
    console.error('uploadDocument error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

/**
 * POST /api/documents/:id/ask
 * Accepts { question: "...", userId: optional } in JSON body
 * The function finds the document (no auth check) and asks Gemini.
 */
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
