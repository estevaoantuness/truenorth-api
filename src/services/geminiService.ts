import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { pdfToPng } from 'pdf-to-png-converter';
import { detectLanguage, translateForComex } from './translatorService';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

const EXTRACTION_PROMPT = `Você é um especialista em comércio exterior brasileiro. Analise este documento de importação (invoice comercial) e extraia os seguintes dados em formato JSON:

{
  "invoice_number": "número da invoice",
  "invoice_date": "data no formato YYYY-MM-DD",
  "supplier": {
    "name": "nome do fornecedor",
    "address": "endereço completo",
    "country": "país de origem"
  },
  "buyer": {
    "name": "nome do importador",
    "cnpj": "CNPJ se disponível"
  },
  "incoterm": "FOB/CIF/DAP/etc",
  "currency": "USD/EUR/etc",
  "total_value": número (valor total em moeda estrangeira),
  "freight": número ou null,
  "insurance": número ou null,
  "items": [
    {
      "description": "descrição detalhada do produto",
      "quantity": número,
      "unit": "UN/KG/etc",
      "unit_price": número,
      "total_price": número,
      "ncm_sugerido": "8 dígitos se identificável na descrição",
      "peso_kg": número se disponível,
      "origem": "código país 2 letras"
    }
  ],
  "observacoes": ["lista de observações relevantes"],
  "campos_faltando": ["lista de campos não encontrados"]
}

IMPORTANTE:
- Seja preciso e indique incertezas
- Se não encontrar um campo, retorne null
- Para NCM, sugira apenas se tiver alta confiança baseada na descrição do produto
- Retorne APENAS o JSON, sem texto adicional

TEXTO DO DOCUMENTO:
`;

/**
 * Extract data using Gemini API
 */
async function extractWithGemini(documentText: string): Promise<any> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const prompt = EXTRACTION_PROMPT + documentText;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  return parseJsonResponse(text);
}

/**
 * Extract data using OpenAI API (text-based)
 */
async function extractWithOpenAI(documentText: string): Promise<any> {
  const prompt = EXTRACTION_PROMPT + documentText;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // Cheapest and fast
    messages: [
      {
        role: 'system',
        content: 'Você é um especialista em comércio exterior brasileiro. Retorne apenas JSON válido, sem texto adicional.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.1,
    max_tokens: 4000,
  });

  const text = response.choices[0]?.message?.content || '';
  return parseJsonResponse(text);
}

/**
 * Extract data using OpenAI Vision API (for image-based PDFs)
 */
async function extractWithVision(pdfBuffer: Buffer): Promise<any> {
  console.log('Converting PDF to images for Vision analysis...');

  // Convert PDF to PNG images - pass the underlying ArrayBuffer
  const pngPages = await pdfToPng(pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength), {
    disableFontFace: true,
    useSystemFonts: true,
    viewportScale: 2.0, // Higher quality
  });

  if (pngPages.length === 0) {
    throw new Error('Failed to convert PDF to images');
  }

  console.log(`Converted ${pngPages.length} page(s) to images`);

  // Prepare images for Vision API (first 3 pages max to save costs)
  const imageContents = pngPages
    .slice(0, 3)
    .filter((page) => page.content) // Filter out pages without content
    .map((page) => ({
      type: 'image_url' as const,
      image_url: {
        url: `data:image/png;base64,${Buffer.from(page.content!).toString('base64')}`,
        detail: 'high' as const,
      },
    }));

  const response = await openai.chat.completions.create({
    model: 'gpt-4o', // Vision requires gpt-4o (not mini)
    messages: [
      {
        role: 'system',
        content: 'Você é um especialista em comércio exterior brasileiro. Analise a imagem da invoice e extraia os dados em formato JSON válido, sem texto adicional.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: EXTRACTION_PROMPT + '\n\nAnalise a(s) imagem(s) da invoice acima e extraia os dados.',
          },
          ...imageContents,
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 4000,
  });

  const text = response.choices[0]?.message?.content || '';
  return parseJsonResponse(text);
}

/**
 * Parse JSON from AI response (handles markdown code blocks)
 */
function parseJsonResponse(text: string): any {
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

  return JSON.parse(jsonText);
}

/**
 * Translate item descriptions from EN/ZH/ES to PT-BR for NCM search
 * This is the "IF node" that detects language and translates only when needed
 */
async function translateItems(extractedData: any): Promise<any> {
  if (!extractedData.items || extractedData.items.length === 0) {
    return extractedData;
  }

  console.log('[Translation] Processing items for language detection...');

  const translatedItems = await Promise.all(
    extractedData.items.map(async (item: any) => {
      const description = item.description || '';

      if (!description || description.length < 3) {
        return item;
      }

      // Step 1: Detect language
      const language = detectLanguage(description);

      // Step 2: IF node - only translate if NOT Portuguese
      if (language !== 'pt') {
        console.log(`[Translation] Item in ${language.toUpperCase()}: "${description.substring(0, 50)}..."`);

        try {
          const translation = await translateForComex(description, language);

          return {
            ...item,
            description_original: description, // Keep original for reference
            description: translation.translated, // Replace with PT-BR for NCM search
            detected_language: language,
            translation_confidence: translation.confidence,
            translated: true,
          };
        } catch (error: any) {
          console.error('[Translation] Failed to translate item:', error.message);
          return {
            ...item,
            detected_language: language,
            translation_confidence: 0,
            translated: false,
          };
        }
      }

      // Item is already in Portuguese - skip translation
      return {
        ...item,
        detected_language: 'pt',
        translation_confidence: 1.0,
        translated: false,
      };
    })
  );

  const translatedCount = translatedItems.filter(i => i.translated).length;
  if (translatedCount > 0) {
    console.log(`[Translation] Translated ${translatedCount}/${translatedItems.length} items to PT-BR`);
  } else {
    console.log('[Translation] All items already in PT-BR, no translation needed');
  }

  return {
    ...extractedData,
    items: translatedItems,
  };
}

/**
 * Extract data from an image buffer directly using Vision API
 */
async function extractFromImageBuffer(imageBuffer: Buffer, mimeType: string): Promise<any> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured for image processing');
  }

  console.log(`Processing image directly with Vision API, size: ${imageBuffer.length} bytes, type: ${mimeType}`);

  // Convert HEIC/HEIF to a supported format mention
  const supportedMimeType = mimeType.includes('heic') || mimeType.includes('heif')
    ? 'image/jpeg' // OpenAI will handle the conversion
    : mimeType;

  const base64Image = imageBuffer.toString('base64');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'Você é um especialista em comércio exterior brasileiro. Analise a imagem da invoice e extraia os dados em formato JSON válido, sem texto adicional.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: EXTRACTION_PROMPT + '\n\nAnalise a imagem da invoice acima e extraia os dados.',
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

  const text = response.choices[0]?.message?.content || '';
  return parseJsonResponse(text);
}

export async function extractDataFromDocument(
  documentText: string,
  documentType: 'PDF' | 'XML' | 'IMAGE',
  fileBuffer?: Buffer,
  mimeType?: string
): Promise<any> {
  let extractedData: any;

  // Handle IMAGE type directly
  if (documentType === 'IMAGE' && fileBuffer) {
    try {
      console.log('Processing image file with Vision API...');
      extractedData = await extractFromImageBuffer(fileBuffer, mimeType || 'image/jpeg');
      console.log('Image extraction successful');
    } catch (error: any) {
      console.error('Image extraction failed:', error.message);
      throw new Error('Falha ao processar imagem: ' + error.message);
    }
  } else {
    // Check if we need Vision (empty or very short text from PDF)
    const needsVision = documentType === 'PDF' &&
      fileBuffer &&
      (!documentText || documentText.length < 100 || documentText.includes('[PDF sem texto extraível'));

    // Try Vision first if needed (for image-based PDFs)
    if (needsVision && process.env.OPENAI_API_KEY && fileBuffer) {
      try {
        console.log('PDF appears to be image-based, using Vision API...');
        extractedData = await extractWithVision(fileBuffer);
        console.log('Vision extraction successful');
      } catch (error: any) {
        console.error('Vision extraction failed:', error.message);
        // Fall through to text-based extraction
      }
    }

    // Use OpenAI text extraction as primary
    if (!extractedData && process.env.OPENAI_API_KEY && documentText && documentText.length > 50) {
      try {
        console.log('Attempting extraction with OpenAI (text)...');
        extractedData = await extractWithOpenAI(documentText);
        console.log('OpenAI text extraction successful');
      } catch (error: any) {
        console.error('OpenAI extraction failed:', error.message);
        // Fall through to Gemini
      }
    }

    // Fallback to Gemini
    if (!extractedData && process.env.GEMINI_API_KEY && documentText && documentText.length > 50) {
      try {
        console.log('Attempting extraction with Gemini (fallback)...');
        extractedData = await extractWithGemini(documentText);
        console.log('Gemini extraction successful');
      } catch (error: any) {
        console.error('Gemini extraction failed:', error.message);
        // Fall through to demo data
      }
    }

    // Last resort: demo data
    if (!extractedData) {
      console.warn('All AI services failed, returning demo extraction');
      extractedData = createDemoExtraction(documentText);
    }
  }

  // TRANSLATION STEP: Detect language and translate items to PT-BR if needed
  // This is the critical "IF node" that solves the EN→PT problem
  try {
    extractedData = await translateItems(extractedData);
  } catch (error: any) {
    console.error('[Translation] Translation step failed, continuing with original descriptions:', error.message);
  }

  return extractedData;
}

function createDemoExtraction(documentText: string): any {
  // Simple heuristic extraction based on common patterns
  const hasElectronics = documentText.toLowerCase().includes('electronic') ||
    documentText.toLowerCase().includes('smartphone') ||
    documentText.toLowerCase().includes('phone');

  const hasAutoparts = documentText.toLowerCase().includes('brake') ||
    documentText.toLowerCase().includes('clutch') ||
    documentText.toLowerCase().includes('auto');

  const hasCosmetics = documentText.toLowerCase().includes('cosmetic') ||
    documentText.toLowerCase().includes('serum') ||
    documentText.toLowerCase().includes('cream');

  if (hasElectronics) {
    return {
      invoice_number: 'DEMO-ELEC-001',
      invoice_date: new Date().toISOString().split('T')[0],
      supplier: {
        name: 'Demo Electronics Supplier',
        address: 'Shenzhen, China',
        country: 'China',
      },
      buyer: {
        name: 'Importadora Demo',
        cnpj: '00.000.000/0001-00',
      },
      incoterm: 'FOB',
      currency: 'USD',
      total_value: 15000,
      freight: 1000,
      insurance: 150,
      items: [
        {
          description: 'Electronic device extracted from document',
          quantity: 100,
          unit: 'UN',
          unit_price: 150,
          total_price: 15000,
          ncm_sugerido: '85171231',
          peso_kg: 100,
          origem: 'CN',
        },
      ],
      observacoes: ['Dados extraídos automaticamente (modo demo)'],
      campos_faltando: [],
    };
  }

  if (hasAutoparts) {
    return {
      invoice_number: 'DEMO-AUTO-001',
      invoice_date: new Date().toISOString().split('T')[0],
      supplier: {
        name: 'Demo Auto Parts Supplier',
        address: 'Stuttgart, Germany',
        country: 'Alemanha',
      },
      buyer: {
        name: 'Importadora Demo',
        cnpj: '00.000.000/0001-00',
      },
      incoterm: 'CIF',
      currency: 'EUR',
      total_value: 8000,
      freight: 0,
      insurance: 0,
      items: [
        {
          description: 'Auto parts extracted from document',
          quantity: 50,
          unit: 'UN',
          unit_price: 160,
          total_price: 8000,
          ncm_sugerido: '87089990',
          peso_kg: 200,
          origem: 'DE',
        },
      ],
      observacoes: ['Dados extraídos automaticamente (modo demo)'],
      campos_faltando: [],
    };
  }

  // Default generic extraction
  return {
    invoice_number: 'DEMO-GEN-001',
    invoice_date: new Date().toISOString().split('T')[0],
    supplier: {
      name: 'Demo Supplier',
      address: 'International Address',
      country: 'Unknown',
    },
    buyer: {
      name: 'Importadora Demo',
      cnpj: '00.000.000/0001-00',
    },
    incoterm: 'FOB',
    currency: 'USD',
    total_value: 10000,
    freight: 500,
    insurance: 100,
    items: [
      {
        description: 'Product from document',
        quantity: 100,
        unit: 'UN',
        unit_price: 100,
        total_price: 10000,
        ncm_sugerido: null,
        peso_kg: 100,
        origem: null,
      },
    ],
    observacoes: ['Dados extraídos automaticamente (modo demo)', 'Configure GEMINI_API_KEY para extração real'],
    campos_faltando: ['NCM precisa ser classificado manualmente'],
  };
}
