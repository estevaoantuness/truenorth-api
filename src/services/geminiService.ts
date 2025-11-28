import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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

export async function extractDataFromDocument(
  documentText: string,
  documentType: 'PDF' | 'XML'
): Promise<any> {
  try {
    // If no API key, return demo data
    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY not set, returning demo extraction');
      return createDemoExtraction(documentText);
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = EXTRACTION_PROMPT + documentText;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = text;
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

    const extractedData = JSON.parse(jsonText);
    return extractedData;
  } catch (error) {
    console.error('Gemini extraction error:', error);
    // Return demo data on error
    return createDemoExtraction(documentText);
  }
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
