import fs from 'fs';
import PDFParser from 'pdf2json';
// no static import for mammoth or pdf-parse to avoid startup errors if missing
import path from 'path';
import { spawnSync } from 'child_process';

function parsePdf(filePath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', errData => reject(errData.parserError));
    pdfParser.on('pdfParser_dataReady', pdfData => {
      resolve(pdfParser.getRawTextContent());
    });

    pdfParser.loadPDF(filePath);
  });
}

async function parsePdfViaPdfParse(filePath) {
  // Attempt extraction using pdf-parse (works for many PDFs)
  try {
    const { default: pdfParse } = await import('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    const result = await pdfParse(dataBuffer);
    return result?.text || '';
  } catch (e) {
    return '';
  }
}

function parsePdfViaPdftotext(filePath) {
  try {
    const res = spawnSync('pdftotext', ['-layout', filePath, '-'], {
      encoding: 'utf8'
    });
    if (res.status === 0 && res.stdout && res.stdout.trim().length > 0) {
      return res.stdout;
    }
  } catch {}
  return '';
}

function looksLikePdf(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(5);
    fs.readSync(fd, buf, 0, 5, 0);
    fs.closeSync(fd);
    return buf.toString('utf8') === '%PDF-';
  } catch (e) {
    return false;
  }
}

export async function extractText(filePath) {
  try {
    console.info(`[extractText] start path=${filePath} ext=${path.extname(filePath)} looksPdf=${looksLikePdf(filePath)}`);
  } catch {}
  // Prefer extension, but also handle files saved without extensions
  if (filePath.endsWith('.pdf') || looksLikePdf(filePath)) {
    // Try pdf-parse first, fallback to pdf2json
    let text = await parsePdfViaPdfParse(filePath);
    if (!text || !text.trim()) {
      text = await parsePdf(filePath);
    }
    if (!text || !text.trim()) {
      // Optional system-level fallback using Poppler if installed
      text = parsePdfViaPdftotext(filePath);
    }
    try { console.info(`[extractText] pdf text length=${text ? text.length : 0}`); } catch {}
    return text && text.trim() ? text : null;
  }

  if (filePath.endsWith('.docx')) {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      try { console.info(`[extractText] docx text length=${result?.value ? result.value.length : 0}`); } catch {}
      return result.value && result.value.trim() ? result.value : null;
    } catch {
      return null;
    }
  }

  // Best-effort fallback: try DOCX extraction even without extension
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    try { console.info(`[extractText] fallback docx text length=${result?.value ? result.value.length : 0}`); } catch {}
    if (result?.value && result.value.trim()) return result.value;
  } catch {}

  return null;
}
