/**
 * Groq Scraper - Uses Llama 3 via Groq for fast, cheap document extraction
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

DOCUMENTO:
`;

export class GroqScraper implements ScraperProvider {
  name = 'groq';
  private client: Groq;
  private model: string;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY não configurada');
    }
    this.client = new Groq({ apiKey });
    this.model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  }

  async extractFromText(text: string): Promise<RawExtractionResult> {
    console.log(`[GroqScraper] Extracting from text (${text.length} chars) using ${this.model}...`);

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'Você é um extrator de dados. Retorne apenas JSON válido.',
        },
        {
          role: 'user',
          content: SCRAPING_PROMPT + text,
        },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || '';
    console.log(`[GroqScraper] Response received (${content.length} chars)`);

    return this.parseResponse(content);
  }

  async extractFromImage(_imageBuffer: Buffer, _mimeType: string): Promise<RawExtractionResult> {
    // Groq doesn't support image input - throw error to fallback to OpenAI
    throw new Error('Groq não suporta extração de imagens. Use OpenAI Vision.');
  }

  supportsImageExtraction(): boolean {
    return false;
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
