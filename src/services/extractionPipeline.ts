/**
 * Extraction Pipeline - Orchestrates the two-stage document extraction
 *
 * Stage 1: Scraper (Groq/OpenAI) - Fast, cheap extraction of raw data
 * Stage 2: Analyst (GPT-4o) - Classification with database context
 */

import { getScraperProvider, getImageScraper, RawExtractionResult, ClassifiedExtractionResult } from './scrapers';
import { analyzeExtraction } from './analyst';
import { extractTextFromPDFBuffer } from '../utils/pdfParser';
import { pdfToPng } from 'pdf-to-png-converter';

export interface PipelineResult {
  raw: RawExtractionResult;
  classified: ClassifiedExtractionResult;
  metadata: {
    scraperUsed: string;
    extractionMethod: 'text' | 'image' | 'vision';
    processingTimeMs: number;
  };
}

/**
 * Main extraction pipeline - handles PDF, XML, and images
 */
export async function runExtractionPipeline(
  documentType: 'PDF' | 'XML' | 'IMAGE',
  fileBuffer: Buffer,
  mimeType?: string
): Promise<PipelineResult> {
  const startTime = Date.now();
  let raw: RawExtractionResult;
  let scraperUsed: string;
  let extractionMethod: 'text' | 'image' | 'vision';

  console.log(`[Pipeline] Starting extraction for ${documentType}...`);

  // Stage 1: Scraping
  if (documentType === 'IMAGE') {
    // Image: use Vision-capable scraper directly
    const scraper = getImageScraper();
    scraperUsed = scraper.name + '-vision';
    extractionMethod = 'image';

    console.log(`[Pipeline] Using ${scraperUsed} for image extraction`);
    raw = await scraper.extractFromImage(fileBuffer, mimeType || 'image/jpeg');

  } else if (documentType === 'PDF') {
    // PDF: try text extraction first, fallback to Vision
    const textContent = await extractTextFromPDFBuffer(fileBuffer);
    const needsVision = !textContent || textContent.length < 100 || textContent.includes('[PDF sem texto');

    if (needsVision) {
      console.log('[Pipeline] PDF appears to be image-based, using Vision...');
      raw = await extractPdfWithVision(fileBuffer);
      scraperUsed = 'openai-vision';
      extractionMethod = 'vision';
    } else {
      // Text-based PDF
      const scraper = getScraperProvider();
      scraperUsed = scraper.name;
      extractionMethod = 'text';

      console.log(`[Pipeline] Using ${scraperUsed} for text extraction (${textContent.length} chars)`);
      raw = await scraper.extractFromText(textContent);
    }

  } else {
    // XML: parse and extract text
    const xmlContent = fileBuffer.toString('utf-8');
    const scraper = getScraperProvider();
    scraperUsed = scraper.name;
    extractionMethod = 'text';

    console.log(`[Pipeline] Using ${scraperUsed} for XML text extraction`);
    raw = await scraper.extractFromText(xmlContent);
  }

  console.log(`[Pipeline] Stage 1 complete: ${raw.items.length} items extracted`);

  // Stage 2: Analysis with database context
  console.log('[Pipeline] Starting Stage 2 (Analyst)...');
  const classified = await analyzeExtraction(raw);

  const processingTimeMs = Date.now() - startTime;
  console.log(`[Pipeline] Complete in ${processingTimeMs}ms`);

  return {
    raw,
    classified,
    metadata: {
      scraperUsed,
      extractionMethod,
      processingTimeMs,
    },
  };
}

/**
 * Extract data from PDF using Vision (for scanned documents)
 */
async function extractPdfWithVision(pdfBuffer: Buffer): Promise<RawExtractionResult> {
  console.log('[Pipeline] Converting PDF to images for Vision...');

  // Convert PDF to images
  const pngPages = await pdfToPng(
    pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength),
    {
      disableFontFace: true,
      useSystemFonts: true,
      viewportScale: 2.0,
    }
  );

  if (pngPages.length === 0 || !pngPages[0].content) {
    throw new Error('Falha ao converter PDF para imagem');
  }

  console.log(`[Pipeline] Converted ${pngPages.length} page(s)`);

  // Use first page for extraction
  const scraper = getImageScraper();
  return scraper.extractFromImage(Buffer.from(pngPages[0].content), 'image/png');
}

/**
 * Legacy compatibility function - maps to new pipeline
 */
export async function extractDataFromDocument(
  documentText: string,
  documentType: 'PDF' | 'XML' | 'IMAGE',
  fileBuffer?: Buffer,
  mimeType?: string
): Promise<any> {
  // If no buffer provided, create one from text
  const buffer = fileBuffer || Buffer.from(documentText, 'utf-8');

  const result = await runExtractionPipeline(documentType, buffer, mimeType);

  // Return classified result in legacy format
  return result.classified;
}
