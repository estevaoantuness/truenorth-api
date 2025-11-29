/**
 * Analyst Service - Stage 2 of the extraction pipeline
 * Uses Google Gemini with database context to classify and enrich extracted data
 * 100% Gemini - cost effective and powerful
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaClient } from '@prisma/client';
import { RawExtractionResult, ClassifiedExtractionResult, DatabaseContext } from './scrapers/types';
import { searchNcmByDescription, getNcmsBySector, validateNcm } from './ncmService';

const prisma = new PrismaClient();

function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada');
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Detect sector from item descriptions
 * Uses FTS + keyword fallback for accurate sector detection
 */
async function detectSector(items: RawExtractionResult['items']): Promise<string> {
  const descriptions = items.map(i => i.description.toLowerCase()).join(' ');

  const sectorKeywords: Record<string, string[]> = {
    Eletronicos: ['smartphone', 'celular', 'laptop', 'notebook', 'tablet', 'electronic', 'circuit', 'chip', 'led', 'battery', 'charger', 'cable', 'usb', 'hdmi', 'monitor', 'television', 'tv', 'camera', 'speaker', 'headphone', 'earphone'],
    Autopecas: ['brake', 'freio', 'clutch', 'embreagem', 'piston', 'pistão', 'bearing', 'rolamento', 'gear', 'engrenagem', 'suspension', 'suspensão', 'automotive', 'car', 'vehicle', 'motor', 'engine', 'transmission', 'filter', 'filtro'],
    Cosmeticos: ['cosmetic', 'serum', 'cream', 'creme', 'lotion', 'perfume', 'fragrance', 'shampoo', 'conditioner', 'makeup', 'lipstick', 'mascara', 'foundation', 'skincare', 'beauty', 'hair', 'nail'],
    Alimentos: ['food', 'alimento', 'chocolate', 'coffee', 'café', 'tea', 'chá', 'wine', 'vinho', 'olive', 'azeite', 'cheese', 'queijo', 'meat', 'carne', 'fish', 'peixe', 'fruit', 'fruta', 'vegetable', 'organic'],
    Maquinas: ['machine', 'máquina', 'equipment', 'equipamento', 'industrial', 'cnc', 'hydraulic', 'hidráulico', 'pneumatic', 'pneumático', 'compressor', 'pump', 'bomba', 'valve', 'válvula', 'generator', 'gerador'],
    Texteis: ['textile', 'têxtil', 'fabric', 'tecido', 'cotton', 'algodão', 'polyester', 'poliéster', 'silk', 'seda', 'wool', 'lã', 'clothing', 'roupa', 'garment', 'shirt', 'pants', 'dress'],
    Quimicos: ['chemical', 'químico', 'acid', 'ácido', 'solvent', 'solvente', 'polymer', 'polímero', 'resin', 'resina', 'pigment', 'pigmento', 'additive', 'aditivo', 'catalyst', 'catalisador'],
    Medico: ['medical', 'médico', 'surgical', 'cirúrgico', 'diagnostic', 'diagnóstico', 'implant', 'implante', 'prosthesis', 'prótese', 'syringe', 'seringa', 'catheter', 'cateter', 'monitor', 'ultrasound'],
    Brinquedos: ['toy', 'brinquedo', 'game', 'jogo', 'puzzle', 'quebra-cabeça', 'doll', 'boneca', 'action figure', 'lego', 'block', 'bloco', 'plush', 'pelúcia'],
    Construcao: ['construction', 'construção', 'cement', 'cimento', 'steel', 'aço', 'pipe', 'tubo', 'wire', 'fio', 'cable', 'insulation', 'isolamento', 'tile', 'azulejo', 'ceramic', 'cerâmica'],
    Utensilios: ['cutlery', 'talheres', 'fork', 'garfo', 'spoon', 'colher', 'knife', 'faca', 'utensil', 'utensílio', 'tableware', 'flatware', 'silverware', 'ladle', 'concha', 'spatula', 'espátula', 'kitchenware', 'cozinha'],
  };

  // 1. Try keyword matching first (fast)
  for (const [sector, keywords] of Object.entries(sectorKeywords)) {
    if (keywords.some(kw => descriptions.includes(kw))) {
      console.log(`[Analyst] Sector detected by keyword: ${sector}`);
      return sector;
    }
  }

  // 2. Use FTS to detect sector from top NCMs
  try {
    const topNcms = await searchNcmByDescription(descriptions.slice(0, 200), undefined, 20);

    if (topNcms.length > 0) {
      // Count sectors weighted by relevance score
      const sectorScores: Record<string, number> = {};
      topNcms.forEach(ncm => {
        const sector = ncm.setor || 'Geral';
        sectorScores[sector] = (sectorScores[sector] || 0) + ncm.score;
      });

      // Return sector with highest score
      const sortedSectors = Object.entries(sectorScores).sort((a, b) => b[1] - a[1]);
      if (sortedSectors.length > 0 && sortedSectors[0][1] > 0) {
        const detectedSector = sortedSectors[0][0];
        console.log(`[Analyst] Sector detected by FTS: ${detectedSector} (score: ${sortedSectors[0][1].toFixed(2)})`);
        return detectedSector;
      }
    }
  } catch (error) {
    console.warn('[Analyst] FTS sector detection failed, using fallback:', error);
  }

  console.log('[Analyst] No sector detected, using Geral');
  return 'Geral';
}

/**
 * Load database context (NCMs and Anuentes)
 * Now uses ncmService for intelligent search with 15,000+ NCMs
 */
async function loadDatabaseContext(sector?: string, itemDescriptions?: string[]): Promise<DatabaseContext> {
  // Strategy: Combine sector-based + description-based NCM search
  let ncms: any[] = [];

  // 1. Get NCMs by sector (base coverage)
  if (sector && sector !== 'Geral') {
    const sectorNcms = await getNcmsBySector(sector, 50);
    ncms = sectorNcms.map(n => ({
      codigo: n.ncm,
      descricao: n.descricao,
      setor: n.setor,
    }));
    console.log(`[Analyst] Loaded ${ncms.length} NCMs for sector: ${sector}`);
  }

  // 2. Search by item descriptions for better precision
  if (itemDescriptions && itemDescriptions.length > 0) {
    for (const desc of itemDescriptions.slice(0, 5)) { // Top 5 items
      const searchResults = await searchNcmByDescription(desc, sector, 20);
      for (const r of searchResults) {
        // Avoid duplicates
        if (!ncms.find(n => n.codigo === r.ncm)) {
          ncms.push({
            codigo: r.ncm,
            descricao: r.descricao,
            setor: r.setor,
          });
        }
      }
    }
    console.log(`[Analyst] Total NCMs after description search: ${ncms.length}`);
  }

  // 3. Fallback: get general NCMs if nothing found
  if (ncms.length < 20) {
    const fallbackNcms = await prisma.ncmDatabase.findMany({
      take: 100 - ncms.length,
      select: {
        ncm: true,
        descricao: true,
        aliquotaIi: true,
        aliquotaIpi: true,
        setor: true,
        anuentes: true,
      },
    });
    for (const n of fallbackNcms) {
      if (!ncms.find(x => x.codigo === n.ncm)) {
        ncms.push({
          codigo: n.ncm,
          descricao: n.descricao,
          aliquotaIi: n.aliquotaIi?.toString() || '0',
          aliquotaIpi: n.aliquotaIpi?.toString() || '0',
          setor: n.setor || 'Geral',
          anuentes: n.anuentes,
        });
      }
    }
  }

  // Enrich NCMs with aliquotas if missing
  const enrichedNcms = await Promise.all(
    ncms.slice(0, 100).map(async (n) => {
      if (!n.aliquotaIi) {
        const full = await prisma.ncmDatabase.findUnique({
          where: { ncm: n.codigo },
          select: { aliquotaIi: true, aliquotaIpi: true, anuentes: true },
        });
        return {
          ...n,
          aliquotaIi: full?.aliquotaIi?.toString() || '0',
          aliquotaIpi: full?.aliquotaIpi?.toString() || '0',
          anuentes: full?.anuentes || [],
        };
      }
      return n;
    })
  );

  // Load all anuentes
  const anuentes = await prisma.anuente.findMany({
    select: {
      sigla: true,
      nomeCompleto: true,
      descricao: true,
    },
  });

  console.log(`[Analyst] Final context: ${enrichedNcms.length} NCMs, ${anuentes.length} anuentes`);

  return {
    ncms: enrichedNcms.map(n => ({
      codigo: n.codigo,
      descricao: n.descricao,
      aliquotaIi: n.aliquotaIi || '0',
      aliquotaIpi: n.aliquotaIpi || '0',
      setor: n.setor || 'Geral',
      anuentes: n.anuentes || [],
    })),
    anuentes: anuentes.map(a => ({
      sigla: a.sigla,
      nomeCompleto: a.nomeCompleto,
      descricao: a.descricao || '',
    })),
  };
}

/**
 * Build the analyst prompt with database context
 */
function buildAnalystPrompt(rawData: RawExtractionResult, dbContext: DatabaseContext, sector: string): string {
  const ncmList = dbContext.ncms
    .slice(0, 50) // Top 50 most relevant
    .map(n => `${n.codigo}: ${n.descricao} (${n.setor}) - II:${n.aliquotaIi}% IPI:${n.aliquotaIpi}% - Anuentes: ${n.anuentes.join(', ') || 'Nenhum'}`)
    .join('\n');

  const anuentesList = dbContext.anuentes
    .map(a => `${a.sigla}: ${a.nomeCompleto} - ${a.descricao}`)
    .join('\n');

  return `Você é um especialista em classificação de mercadorias para importação no Brasil.

DADOS EXTRAÍDOS DO DOCUMENTO:
${JSON.stringify(rawData, null, 2)}

SETOR DETECTADO: ${sector}

BASE DE DADOS DE NCMs DISPONÍVEIS:
${ncmList}

ÓRGÃOS ANUENTES CONHECIDOS:
${anuentesList}

TAREFA:
1. Para cada item, classifique o NCM mais apropriado da lista acima
2. Indique o nível de confiança (ALTA/MEDIA/BAIXA)
3. Liste os anuentes necessários baseado no NCM
4. Complete campos faltantes com valores padrão se possível

IMPORTANTE:
- Use APENAS NCMs que existem na lista acima
- Se o produto NÃO se encaixar em nenhum NCM da lista, retorne ncm_sugerido: null
- NÃO invente códigos NCM terminados em 9990, 0000 ou outros genéricos
- Prefira retornar null do que um NCM incorreto
- Se tiver dúvida entre dois NCMs, escolha o mais específico para o produto

RETORNE JSON no formato:
{
  "invoice_number": "string",
  "invoice_date": "YYYY-MM-DD",
  "supplier": { "name": "string", "address": "string", "country": "string" },
  "buyer": { "name": "string", "cnpj": "string" },
  "incoterm": "string ou null",
  "currency": "string",
  "total_value": number,
  "freight": number ou null,
  "insurance": number ou null,
  "items": [
    {
      "description": "string",
      "quantity": number,
      "unit": "string",
      "unit_price": number,
      "total_price": number,
      "ncm_sugerido": "8 dígitos",
      "ncm_descricao": "descrição do NCM",
      "ncm_confianca": "ALTA/MEDIA/BAIXA",
      "peso_kg": number ou null,
      "origem": "XX",
      "anuentes_necessarios": ["SIGLA1", "SIGLA2"]
    }
  ],
  "observacoes": ["lista de observações"],
  "campos_faltando": ["campos não encontrados"],
  "setor_detectado": "${sector}",
  "anuentes_operacao": ["lista única de anuentes para toda operação"],
  "feedback_especialista": "1-3 frases de dica personalizada",
  "impostos_estimados": {
    "ii": number (valor_total × aliquota_ii do NCM / 100),
    "ipi": number (valor_total × aliquota_ipi do NCM / 100),
    "pis_cofins": number (valor_total × 0.1165),
    "total_impostos": number (soma de ii + ipi + pis_cofins),
    "base_calculo": number (valor_total usado no cálculo)
  },
  "descricao_di": "Texto técnico detalhado para Declaração de Importação",
  "alerta_subfaturamento": "string com alerta OU null se ok"
}

FEEDBACK ESPECIALISTA (OBRIGATÓRIO - campo "feedback_especialista"):
Você é um consultor sênior de comércio exterior com 20+ anos de experiência.
Gere um feedback técnico e autoritativo que DEVE conter:

1. DADOS CONCRETOS: Mencione o NCM principal, país de origem e valor da operação
2. RISCO IDENTIFICADO: Aponte o principal ponto de atenção desta invoice específica
3. CONTEXTO DO SETOR: Dica específica baseada no setor detectado:
   - QUÍMICA: licenças ANVISA/IBAMA, FISPQ, produtos controlados
   - ELETRÔNICOS: homologação ANATEL, dumping chinês, certificação INMETRO
   - ALIMENTOS: registro MAPA, SIF/SIE, validade, temperatura
   - MÁQUINAS/EQUIPAMENTOS: ex-tarifário, depreciação, NCM específico de partes
   - TÊXTIL: medidas antidumping, origem preferencial, composição
   - AUTOMOTIVO: LCVM, certificação INMETRO, recall
   - METALURGIA/CUTELARIA: origem da matéria-prima, certificado de conformidade
4. REFERÊNCIA NORMATIVA: Cite IN RFB, Portaria SECEX ou norma relevante quando aplicável

FORMATO: 2-4 frases no tom de consultor experiente. NÃO seja genérico - fale especificamente sobre ESTA invoice.

EXEMPLO DE TOM CORRETO:
"Operações com NCM 8471 (computadores) originárias da China frequentemente são direcionadas ao canal amarelo pela RFB devido ao histórico de subfaturamento no setor. Para este valor de USD X, recomendo ter em mãos a homologação ANATEL e documentação de preço (cotações, catálogos) conforme IN RFB 1861/2018. Atenção especial à descrição detalhada - evite termos genéricos como 'eletrônicos' na DI."

IMPOSTOS ESTIMADOS:
Calcule os impostos usando as alíquotas do NCM selecionado:
- II (Imposto de Importação): valor_total × aliquota_ii%
- IPI (Imposto sobre Produtos Industrializados): valor_total × aliquota_ipi%
- PIS/COFINS: valor_total × 11.65% (fixo)
- total_impostos: soma dos três
- base_calculo: valor total da invoice usado

DESCRIÇÃO DI:
Gere uma "descricao_di" técnica e detalhada para o Portal Único contendo:
- Nome comercial e técnico do produto
- Material/composição principal
- Aplicação/uso
- Características relevantes (dimensões, capacidade, etc se disponível)
- Marca/modelo se informado
Formato: texto corrido, sem quebras de linha, máximo 500 caracteres

ALERTA SUBFATURAMENTO:
Analise a relação valor/peso da mercadoria:
- Se valor/kg for muito baixo para o tipo de produto (ex: eletrônicos < $5/kg, cosméticos < $10/kg), gere alerta
- Se parecer normal, retorne null
- Considere o setor detectado na análise

Retorne APENAS o JSON, sem texto adicional.`;
}

/**
 * Analyze raw extraction and classify with database context
 */
export async function analyzeExtraction(rawData: RawExtractionResult): Promise<ClassifiedExtractionResult> {
  console.log('[Analyst] Starting classification...');

  // Detect sector from items
  const sector = await detectSector(rawData.items);
  console.log(`[Analyst] Detected sector: ${sector}`);

  // Extract item descriptions for smart NCM search
  const itemDescriptions = rawData.items.map(i => i.description).filter(d => d && d.length > 3);
  console.log(`[Analyst] Item descriptions: ${itemDescriptions.slice(0, 3).join(', ')}...`);

  // Load database context with intelligent search
  const dbContext = await loadDatabaseContext(sector, itemDescriptions);

  // Build prompt and call Gemini
  const prompt = buildAnalystPrompt(rawData, dbContext, sector);
  const genAI = getGeminiClient();
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  console.log(`[Analyst] Calling Gemini (${modelName})...`);

  const model = genAI.getGenerativeModel({ model: modelName });

  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [{ text: 'Você é um especialista em classificação fiscal de mercadorias importadas. Retorne apenas JSON válido.\n\n' + prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4000,
    },
  });

  const response = await result.response;
  const content = response.text();
  console.log(`[Analyst] Gemini response received (${content.length} chars)`);

  return parseAnalystResponse(content, rawData);
}

/**
 * Parse analyst response into classified result
 */
function parseAnalystResponse(text: string, fallbackData: RawExtractionResult): ClassifiedExtractionResult {
  let jsonText = text;

  // Handle markdown code blocks
  const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1];
  } else {
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      jsonText = text.substring(jsonStart, jsonEnd + 1);
    }
  }

  try {
    const parsed = JSON.parse(jsonText);

    // Ensure required structure
    return {
      invoice_number: parsed.invoice_number || fallbackData.invoice_number || 'N/A',
      invoice_date: parsed.invoice_date || fallbackData.invoice_date || new Date().toISOString().split('T')[0],
      supplier: {
        name: parsed.supplier?.name || fallbackData.supplier_name || 'N/A',
        address: parsed.supplier?.address || fallbackData.supplier_address || 'N/A',
        country: parsed.supplier?.country || fallbackData.supplier_country || 'N/A',
      },
      buyer: {
        name: parsed.buyer?.name || fallbackData.buyer_name || 'N/A',
        cnpj: parsed.buyer?.cnpj || fallbackData.buyer_cnpj || 'N/A',
      },
      incoterm: parsed.incoterm || fallbackData.incoterm || null,
      currency: parsed.currency || fallbackData.currency || 'USD',
      total_value: parsed.total_value || fallbackData.total_value || 0,
      freight: parsed.freight ?? fallbackData.freight ?? null,
      insurance: parsed.insurance ?? fallbackData.insurance ?? null,
      items: (parsed.items || []).map((item: any, index: number) => ({
        description: item.description || fallbackData.items[index]?.description || 'N/A',
        quantity: item.quantity || fallbackData.items[index]?.quantity || 1,
        unit: item.unit || fallbackData.items[index]?.unit || 'UN',
        unit_price: item.unit_price || fallbackData.items[index]?.unit_price || 0,
        total_price: item.total_price || fallbackData.items[index]?.total_price || 0,
        ncm_sugerido: item.ncm_sugerido || null,
        ncm_descricao: item.ncm_descricao,
        ncm_confianca: item.ncm_confianca,
        peso_kg: item.peso_kg ?? fallbackData.items[index]?.weight_kg ?? null,
        origem: item.origem || fallbackData.items[index]?.origin_country || null,
        anuentes_necessarios: item.anuentes_necessarios || [],
      })),
      observacoes: parsed.observacoes || fallbackData.observations || [],
      campos_faltando: parsed.campos_faltando || fallbackData.missing_fields || [],
      setor_detectado: parsed.setor_detectado,
      anuentes_operacao: parsed.anuentes_operacao || [],
      feedback_especialista: parsed.feedback_especialista || null,
      impostos_estimados: parsed.impostos_estimados || null,
      descricao_di: parsed.descricao_di || null,
      alerta_subfaturamento: parsed.alerta_subfaturamento || null,
    };
  } catch (error) {
    console.error('[Analyst] Failed to parse response:', error);

    // Return minimal classified structure from raw data
    return {
      invoice_number: fallbackData.invoice_number || 'PARSE_ERROR',
      invoice_date: fallbackData.invoice_date || new Date().toISOString().split('T')[0],
      supplier: {
        name: fallbackData.supplier_name || 'N/A',
        address: fallbackData.supplier_address || 'N/A',
        country: fallbackData.supplier_country || 'N/A',
      },
      buyer: {
        name: fallbackData.buyer_name || 'N/A',
        cnpj: fallbackData.buyer_cnpj || 'N/A',
      },
      incoterm: fallbackData.incoterm || null,
      currency: fallbackData.currency || 'USD',
      total_value: fallbackData.total_value || 0,
      freight: fallbackData.freight ?? null,
      insurance: fallbackData.insurance ?? null,
      items: fallbackData.items.map(item => ({
        description: item.description,
        quantity: item.quantity || 1,
        unit: item.unit || 'UN',
        unit_price: item.unit_price || 0,
        total_price: item.total_price || 0,
        ncm_sugerido: null,
        peso_kg: item.weight_kg ?? null,
        origem: item.origin_country || null,
        anuentes_necessarios: [],
      })),
      observacoes: ['Erro ao processar classificação - dados brutos mantidos'],
      campos_faltando: ['NCM para todos os itens'],
    };
  }
}
