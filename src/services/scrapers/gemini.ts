/**
 * Gemini Scraper - Uses Google Gemini for document extraction
 * Supports both text and vision (multimodal) extraction
 * 100% Gemini - cost effective and powerful
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ScraperProvider, RawExtractionResult } from './types';

const SCRAPING_PROMPT = `Você é um extrator de dados de documentos de importação. Analise o documento e extraia os dados em formato JSON.

IMPORTANTE:
- Extraia APENAS o que está escrito no documento
- NÃO classifique produtos (sem NCM)
- NÃO valide dados
- Se um campo não existir, omita ou use null
- Retorne APENAS JSON válido, sem texto adicional

Formato esperado:
{
  "invoice_number": "string ou null",
  "invoice_date": "YYYY-MM-DD ou null",
  "supplier_name": "string ou null",
  "supplier_address": "string ou null",
  "supplier_country": "string ou null",
  "buyer_name": "string ou null",
  "buyer_cnpj": "string ou null",
  "incoterm": "FOB/CIF/etc ou null",
  "currency": "USD/EUR/BRL ou null",
  "total_value": number ou null,
  "freight": number ou null,
  "insurance": number ou null,
  "items": [
    {
      "description": "descrição exata do produto",
      "quantity": number ou null,
      "unit": "UN/KG/etc ou null",
      "unit_price": number ou null,
      "total_price": number ou null,
      "weight_kg": number ou null,
      "origin_country": "código 2 letras ou null"
    }
  ],
  "observations": ["observações relevantes"],
  "missing_fields": ["campos não encontrados"]
}
`;

export class GeminiScraper implements ScraperProvider {
  name = 'gemini';
  private genAI: GoogleGenerativeAI;
  private model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY não configurada');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  }

  async extractFromText(text: string): Promise<RawExtractionResult> {
    console.log(`[GeminiScraper] Extracting from text (${text.length} chars) using ${this.model}...`);

    const model = this.genAI.getGenerativeModel({ model: this.model });

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: SCRAPING_PROMPT + '\nDOCUMENTO:\n' + text }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4000,
      },
    });

    const response = await result.response;
    const content = response.text();
    console.log(`[GeminiScraper] Response received (${content.length} chars)`);

    return this.parseResponse(content);
  }

  async extractFromImage(imageBuffer: Buffer, mimeType: string): Promise<RawExtractionResult> {
    console.log(`[GeminiScraper] Extracting from image (${imageBuffer.length} bytes) using ${this.model}...`);

    const model = this.genAI.getGenerativeModel({ model: this.model });

    // Normalize mime type for Gemini
    let normalizedMimeType = mimeType;
    if (mimeType.includes('heic') || mimeType.includes('heif')) {
      normalizedMimeType = 'image/jpeg';
    }

    // Convert buffer to base64
    const base64Image = imageBuffer.toString('base64');

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: SCRAPING_PROMPT + '\n\nAnalise a imagem do documento e extraia os dados.' },
            {
              inlineData: {
                mimeType: normalizedMimeType,
                data: base64Image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4000,
      },
    });

    const response = await result.response;
    const content = response.text();
    console.log(`[GeminiScraper] Vision response received (${content.length} chars)`);

    return this.parseResponse(content);
  }

  supportsImageExtraction(): boolean {
    return true;
  }

  private parseResponse(text: string): RawExtractionResult {
    let jsonText = text;

    // Handle markdown code blocks
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    } else {
      // Try to find raw JSON
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        jsonText = text.substring(jsonStart, jsonEnd + 1);
      }
    }

    try {
      const parsed = JSON.parse(jsonText);

      // Ensure items is always an array
      if (!parsed.items || !Array.isArray(parsed.items)) {
        parsed.items = [];
      }

      return parsed as RawExtractionResult;
    } catch (error) {
      console.error('[GeminiScraper] Failed to parse JSON:', error);
      return {
        items: [],
        observations: ['Falha ao processar resposta do modelo'],
        missing_fields: ['Todos os campos'],
      };
    }
  }
}
