import fs from 'fs';
import PDFParser from 'pdf2json';
import * as docx from 'docx';

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

export async function extractText(filePath) {
  if (filePath.endsWith('.pdf')) {
    const text = await parsePdf(filePath);
    return text;

  } else if (filePath.endsWith('.docx')) {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  return null;
}
