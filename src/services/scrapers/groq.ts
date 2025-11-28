/**
 * Groq Scraper - Uses Llama 3 via Groq for fast, cheap document extraction
 * Supports both text (Llama 3.3) and vision (Llama 3.2 Vision) extraction
 * This is Stage 1 of the pipeline - raw extraction without classification
 */

import Groq from 'groq-sdk';
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

export class GroqScraper implements ScraperProvider {
  name = 'groq';
  private client: Groq;
  private textModel: string;
  private visionModel: string;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY não configurada');
    }
    this.client = new Groq({ apiKey });
    this.textModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    this.visionModel = process.env.GROQ_VISION_MODEL || 'llama-3.2-90b-vision-preview';
  }

  async extractFromText(text: string): Promise<RawExtractionResult> {
    console.log(`[GroqScraper] Extracting from text (${text.length} chars) using ${this.textModel}...`);

    const response = await this.client.chat.completions.create({
      model: this.textModel,
      messages: [
        {
          role: 'system',
          content: 'Você é um extrator de dados. Retorne apenas JSON válido.',
        },
        {
          role: 'user',
          content: SCRAPING_PROMPT + '\nDOCUMENTO:\n' + text,
        },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || '';
    console.log(`[GroqScraper] Response received (${content.length} chars)`);

    return this.parseResponse(content);
  }

  async extractFromImage(imageBuffer: Buffer, mimeType: string): Promise<RawExtractionResult> {
    console.log(`[GroqScraper] Extracting from image (${imageBuffer.length} bytes) using ${this.visionModel}...`);

    // Convert buffer to base64
    const base64Image = imageBuffer.toString('base64');

    // Normalize mime type
    let normalizedMimeType = mimeType;
    if (mimeType.includes('heic') || mimeType.includes('heif')) {
      normalizedMimeType = 'image/jpeg';
    }

    const response = await this.client.chat.completions.create({
      model: this.visionModel,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: SCRAPING_PROMPT + '\n\nAnalise a imagem do documento acima e extraia os dados.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${normalizedMimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || '';
    console.log(`[GroqScraper] Vision response received (${content.length} chars)`);

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
      console.error('[GroqScraper] Failed to parse JSON:', error);
      // Return minimal structure on parse failure
      return {
        items: [],
        observations: ['Falha ao processar resposta do modelo'],
        missing_fields: ['Todos os campos'],
      };
    }
  }
}
