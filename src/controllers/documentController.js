// src/controllers/documentController.js
import fs from 'fs';
import fetch from 'node-fetch';
import { prisma } from '../prismaClient.js';
import { extractText } from '../services/extractText.js';

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

    const text = await extractText(document.filePath);
    if (!text) return res.status(500).json({ error: 'Unable to extract text' });

    const prompt = `Answer the question based on the following document:\n\n${text}\n\nQuestion: ${question}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data });

    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No answer';
    res.json({ answer });
  } catch (err) {
    console.error('askQuestion error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
