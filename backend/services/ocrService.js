/**
 * OCR service. Plug in your provider of choice (Google Cloud Vision,
 * AWS Textract, Tesseract.js for a free/offline option) using OCR_PROVIDER_API_KEY.
 *
 * All three OCR entry points (PDF upload, book image upload, camera scan)
 * funnel through extractTextFromImage / extractTextFromPdf so the rest of
 * the app only ever deals with plain extracted text.
 */

const requireKey = () => {
  if (!process.env.OCR_PROVIDER_API_KEY) {
    const err = new Error('OCR_PROVIDER_API_KEY is not set. Add your OCR provider key to .env.');
    err.statusCode = 501;
    throw err;
  }
};

export const extractTextFromImage = async (fileBuffer) => {
  requireKey();
  // Example (Tesseract.js, no API key needed, works fully offline):
  // import { createWorker } from 'tesseract.js';
  // const worker = await createWorker('eng');
  // const { data } = await worker.recognize(fileBuffer);
  // await worker.terminate();
  // return data.text;
  throw new Error('OCR provider not yet connected. See services/ocrService.js');
};

export const extractTextFromPdf = async (fileBuffer) => {
  requireKey();
  throw new Error('OCR provider not yet connected. See services/ocrService.js');
};
