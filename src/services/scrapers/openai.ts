/**
 * OpenAI Scraper - Uses GPT-4o-mini for text extraction or GPT-4o for images
 * This is an alternative scraper for Stage 1 when Groq is unavailable
 */

import OpenAI from 'openai';
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

export class OpenAIScraper implements ScraperProvider {
  name = 'openai';
  private client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY não configurada');
    }
    this.client = new OpenAI({ apiKey });
  }

  async extractFromText(text: string): Promise<RawExtractionResult> {
    console.log(`[OpenAIScraper] Extracting from text (${text.length} chars)...`);

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
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
    console.log(`[OpenAIScraper] Response received (${content.length} chars)`);

    return this.parseResponse(content);
  }

  async extractFromImage(imageBuffer: Buffer, mimeType: string): Promise<RawExtractionResult> {
    console.log(`[OpenAIScraper] Extracting from image (${imageBuffer.length} bytes, ${mimeType})...`);

    const base64Image = imageBuffer.toString('base64');
    const supportedMimeType = mimeType.includes('heic') || mimeType.includes('heif')
      ? 'image/jpeg'
      : mimeType;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Você é um extrator de dados. Analise a imagem e retorne apenas JSON válido.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: SCRAPING_PROMPT + '\n\nAnalise a imagem do documento acima.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${supportedMimeType};base64,${base64Image}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || '';
    console.log(`[OpenAIScraper] Vision response received (${content.length} chars)`);

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
      console.error('[OpenAIScraper] Failed to parse JSON:', error);
      return {
        items: [],
        observations: ['Falha ao processar resposta do modelo'],
        missing_fields: ['Todos os campos'],
      };
    }
  }
}
