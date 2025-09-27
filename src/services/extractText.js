import fs from 'fs';
import pdf from 'pdf-parse';
import * as docx from 'docx';

export async function extractText(filePath) {
  if (filePath.endsWith('.pdf')) {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  } else if (filePath.endsWith('.docx')) {
    const buffer = fs.readFileSync(filePath);
    const zip = await docx.Packer.load(buffer);
    // For simplicity use a docx parsing lib like mammoth:
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }
  return null;
}
