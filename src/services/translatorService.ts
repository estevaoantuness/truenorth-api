/**
 * Translator Service - Contextual translation for COMEX/NCM
 *
 * Solves the language barrier problem: Invoices come in EN/ZH/ES but NCM database is in PT-BR
 *
 * Features:
 * - Language detection (EN, ES, ZH, PT)
 * - Commerce-specific dictionary (~200 terms)
 * - Gemini fallback for unknown terms
 * - Optimized for COMEX terminology
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface TranslationResult {
  original: string;
  translated: string;
  sourceLanguage: string;
  confidence: number;
  fromCache: boolean;
}

/**
 * COMEX Dictionary - Specialized terminology for Brazilian imports
 * English → Portuguese (Brazilian commerce terminology)
 */
const COMEX_DICTIONARY: Record<string, string[]> = {
  // Electronics (70% of imports)
  'smartphone': ['telefone celular', 'aparelho celular'],
  'cell phone': ['telefone celular', 'celular'],
  'mobile phone': ['telefone móvel', 'celular'],
  'earbuds': ['fones de ouvido', 'auriculares sem fio'],
  'wireless earbuds': ['fones de ouvido sem fio'],
  'headphones': ['fones de ouvido', 'auriculares'],
  'bluetooth': ['sem fio', 'bluetooth'],
  'wireless': ['sem fio'],
  'power bank': ['bateria externa', 'carregador portátil'],
  'portable charger': ['carregador portátil', 'bateria externa'],
  'led display': ['display led', 'visor led', 'tela led'],
  'lcd display': ['display lcd', 'visor lcd'],
  'circuit board': ['placa de circuito impresso', 'pcb'],
  'pcb': ['placa de circuito impresso'],
  'charger': ['carregador', 'fonte de alimentação'],
  'cable': ['cabo', 'fio'],
  'usb cable': ['cabo usb'],
  'hdmi cable': ['cabo hdmi'],
  'adapter': ['adaptador', 'conversor'],
  'battery': ['bateria', 'pilha'],
  'lithium battery': ['bateria de lítio', 'bateria de íon-lítio'],
  'lithium ion': ['íon de lítio', 'íon-lítio'],
  'screen protector': ['película protetora', 'protetor de tela'],
  'phone case': ['capa de celular', 'case'],
  'memory card': ['cartão de memória'],
  'usb flash drive': ['pen drive', 'drive usb'],
  'webcam': ['câmera web', 'webcam'],
  'speaker': ['alto-falante', 'caixa de som'],
  'microphone': ['microfone'],
  'keyboard': ['teclado'],
  'mouse': ['mouse', 'rato'],
  'monitor': ['monitor', 'tela'],
  'laptop': ['notebook', 'laptop'],
  'tablet': ['tablet', 'tablete'],
  'router': ['roteador'],
  'modem': ['modem'],
  'antenna': ['antena'],

  // Auto Parts (15% of imports)
  'brake pads': ['pastilhas de freio', 'guarnições de freio'],
  'brake disc': ['disco de freio'],
  'brake drum': ['tambor de freio'],
  'brake fluid': ['fluido de freio'],
  'spark plug': ['vela de ignição'],
  'oil filter': ['filtro de óleo'],
  'air filter': ['filtro de ar'],
  'fuel filter': ['filtro de combustível'],
  'clutch': ['embreagem'],
  'clutch disc': ['disco de embreagem'],
  'shock absorber': ['amortecedor'],
  'suspension': ['suspensão'],
  'steering wheel': ['volante de direção'],
  'headlight': ['farol dianteiro', 'farol'],
  'tail light': ['lanterna traseira'],
  'turn signal': ['pisca-pisca', 'seta'],
  'bumper': ['para-choque', 'para-choques'],
  'radiator': ['radiador'],
  'alternator': ['alternador'],
  'starter motor': ['motor de arranque'],
  'timing belt': ['correia dentada'],
  'serpentine belt': ['correia serpentina'],
  'windshield wiper': ['limpador de para-brisa'],
  'side mirror': ['espelho retrovisor lateral'],
  'muffler': ['silencioso', 'escapamento'],
  'exhaust pipe': ['tubo de escape'],
  'catalytic converter': ['conversor catalítico'],
  'wheel bearing': ['rolamento de roda'],
  'ball joint': ['junta esférica'],
  'tie rod': ['terminal de direção'],

  // Food & Beverages (8% of imports)
  'olive oil': ['azeite de oliva', 'óleo de oliva'],
  'extra virgin': ['extravirgem', 'extra virgem'],
  'virgin olive oil': ['azeite virgem'],
  'sunflower oil': ['óleo de girassol'],
  'soybean oil': ['óleo de soja'],
  'palm oil': ['óleo de palma', 'óleo de dendê'],
  'coconut oil': ['óleo de coco'],
  'wine': ['vinho'],
  'red wine': ['vinho tinto'],
  'white wine': ['vinho branco'],
  'sparkling wine': ['vinho espumante'],
  'beer': ['cerveja'],
  'craft beer': ['cerveja artesanal'],
  'spirits': ['bebidas destiladas', 'destilados'],
  'whiskey': ['uísque'],
  'vodka': ['vodka', 'vodca'],
  'chocolate': ['chocolate'],
  'dark chocolate': ['chocolate amargo'],
  'milk chocolate': ['chocolate ao leite'],
  'coffee': ['café'],
  'instant coffee': ['café instantâneo'],
  'ground coffee': ['café moído'],
  'tea': ['chá'],
  'green tea': ['chá verde'],
  'black tea': ['chá preto'],
  'sugar': ['açúcar'],
  'brown sugar': ['açúcar mascavo'],
  'flour': ['farinha'],
  'wheat flour': ['farinha de trigo'],
  'rice': ['arroz'],
  'pasta': ['massa', 'macarrão'],
  'canned food': ['alimento enlatado', 'conserva'],
  'frozen food': ['alimento congelado'],
  'dried fruit': ['fruta seca', 'fruta desidratada'],
  'nuts': ['nozes', 'castanhas'],
  'honey': ['mel'],
  'jam': ['geleia'],
  'vinegar': ['vinagre'],
  'sauce': ['molho'],
  'spice': ['especiaria', 'tempero'],

  // Chemicals & Cosmetics (5% of imports)
  'shampoo': ['xampu', 'shampoo'],
  'conditioner': ['condicionador'],
  'hair mask': ['máscara capilar'],
  'perfume': ['perfume', 'fragrância'],
  'cologne': ['colônia'],
  'cream': ['creme'],
  'face cream': ['creme facial'],
  'lotion': ['loção'],
  'body lotion': ['loção corporal'],
  'soap': ['sabão', 'sabonete'],
  'liquid soap': ['sabonete líquido'],
  'shower gel': ['gel de banho'],
  'detergent': ['detergente'],
  'fabric softener': ['amaciante'],
  'bleach': ['água sanitária', 'alvejante'],
  'solvent': ['solvente'],
  'adhesive': ['adesivo', 'cola'],
  'glue': ['cola'],
  'paint': ['tinta'],
  'varnish': ['verniz'],
  'resin': ['resina'],
  'polymer': ['polímero'],
  'plastic': ['plástico'],
  'lipstick': ['batom'],
  'nail polish': ['esmalte'],
  'makeup': ['maquiagem'],
  'foundation': ['base'],
  'mascara': ['rímel'],
  'eyeshadow': ['sombra'],
  'sunscreen': ['protetor solar'],
  'moisturizer': ['hidratante'],
  'serum': ['sérum'],

  // Textiles (4% of imports)
  'cotton': ['algodão'],
  'polyester': ['poliéster'],
  'nylon': ['náilon', 'nylon'],
  'silk': ['seda'],
  'wool': ['lã'],
  'linen': ['linho'],
  'fabric': ['tecido'],
  't-shirt': ['camiseta'],
  'shirt': ['camisa'],
  'jacket': ['jaqueta', 'casaco'],
  'coat': ['casaco', 'sobretudo'],
  'pants': ['calça'],
  'jeans': ['jeans', 'calça jeans'],
  'dress': ['vestido'],
  'skirt': ['saia'],
  'shoes': ['calçados', 'sapatos'],
  'sneakers': ['tênis'],
  'boots': ['botas'],
  'sandals': ['sandálias'],
  'socks': ['meias'],
  'underwear': ['roupa íntima'],
  'bra': ['sutiã'],
  'bedding': ['roupa de cama'],
  'towel': ['toalha'],
  'blanket': ['cobertor'],

  // Machinery & Equipment (3% of imports)
  'pump': ['bomba'],
  'water pump': ['bomba d\'água'],
  'valve': ['válvula'],
  'compressor': ['compressor'],
  'air compressor': ['compressor de ar'],
  'motor': ['motor'],
  'electric motor': ['motor elétrico'],
  'engine': ['motor', 'máquina motriz'],
  'diesel engine': ['motor diesel'],
  'generator': ['gerador'],
  'conveyor': ['esteira transportadora', 'transportador'],
  'bearing': ['rolamento'],
  'gear': ['engrenagem'],
  'gearbox': ['caixa de engrenagens'],
  'transformer': ['transformador'],
  'inverter': ['inversor'],
  'drill': ['furadeira', 'broca'],
  'saw': ['serra'],
  'lathe': ['torno'],
  'welding machine': ['máquina de solda'],
  'hydraulic': ['hidráulico'],
  'pneumatic': ['pneumático'],

  // Metals & Hardware (2% of imports)
  'steel': ['aço'],
  'stainless steel': ['aço inoxidável'],
  'carbon steel': ['aço carbono'],
  'aluminum': ['alumínio'],
  'aluminium': ['alumínio'],
  'copper': ['cobre'],
  'iron': ['ferro'],
  'cast iron': ['ferro fundido'],
  'brass': ['latão'],
  'bronze': ['bronze'],
  'zinc': ['zinco'],
  'titanium': ['titânio'],
  'screw': ['parafuso'],
  'bolt': ['parafuso', 'cavilha'],
  'nut': ['porca'],
  'washer': ['arruela'],
  'nail': ['prego'],
  'rivet': ['rebite'],
  'pipe': ['tubo', 'cano'],
  'steel pipe': ['tubo de aço'],
  'sheet': ['chapa', 'folha'],
  'metal sheet': ['chapa metálica'],
  'wire': ['arame', 'fio'],
  'steel wire': ['arame de aço'],
  'rod': ['barra', 'haste'],
  'steel rod': ['barra de aço'],
  'chain': ['corrente'],
  'hinge': ['dobradiça'],
  'lock': ['fechadura'],
  'handle': ['maçaneta', 'alça'],

  // Common adjectives and terms
  'high quality': ['alta qualidade'],
  'premium': ['premium', 'superior'],
  'professional': ['profissional'],
  'industrial': ['industrial'],
  'commercial': ['comercial'],
  'household': ['doméstico', 'residencial'],
  'portable': ['portátil'],
  'rechargeable': ['recarregável'],
  'waterproof': ['à prova d\'água', 'impermeável'],
  'stainless': ['inoxidável'],
  'heavy duty': ['uso pesado', 'reforçado'],
  'original': ['original'],
  'genuine': ['genuíno', 'original'],
  'replacement': ['substituto', 'reposição'],
  'spare part': ['peça de reposição'],
  'new': ['novo'],
  'used': ['usado'],
  'refurbished': ['recondicionado'],
  'compatible': ['compatível'],
  'universal': ['universal'],
};

/**
 * Detect language using pattern matching
 * Returns: 'pt', 'en', 'es', 'zh'
 */
export function detectLanguage(text: string): string {
  if (!text || text.length < 3) return 'en';

  const textLower = text.toLowerCase();

  // Pattern detection for each language
  const patterns = {
    pt: /\b(de|da|do|dos|das|para|com|em|uma|um|são|está|foi|ser|pelo|pela|pelos|pelas|que|não|mas|como|quando|onde)\b/gi,
    en: /\b(the|is|are|was|were|with|for|from|this|that|have|has|and|or|but|not|all|when|where|which|who)\b/gi,
    es: /\b(el|la|los|las|del|de la|una|uno|con|para|por|está|son|que|pero|como|cuando|donde)\b/gi,
    zh: /[\u4e00-\u9fff]/g, // Chinese characters
  };

  const scores: Record<string, number> = {};

  for (const [lang, pattern] of Object.entries(patterns)) {
    const matches = textLower.match(pattern);
    scores[lang] = matches ? matches.length : 0;
  }

  // Chinese has priority (unique character set)
  if (scores.zh > 0) return 'zh';

  // Sort by score
  const sorted = Object.entries(scores)
    .filter(([lang]) => lang !== 'zh')
    .sort((a, b) => b[1] - a[1]);

  // If Portuguese has significant score (2+ matches), return PT
  if (sorted[0]?.[0] === 'pt' && sorted[0][1] >= 2) return 'pt';

  // If no strong pattern detected, assume English (most common in invoices)
  if (sorted[0]?.[1] < 2) return 'en';

  return sorted[0][0];
}

/**
 * Translate using COMEX dictionary + Gemini fallback
 */
export async function translateForComex(
  text: string,
  sourceLanguage?: string
): Promise<TranslationResult> {
  // Auto-detect language if not provided
  const detectedLang = sourceLanguage || detectLanguage(text);

  // If already Portuguese, skip translation
  if (detectedLang === 'pt') {
    return {
      original: text,
      translated: text,
      sourceLanguage: 'pt',
      confidence: 1.0,
      fromCache: false,
    };
  }

  // Step 1: Try dictionary translation (fast, accurate, no tokens)
  const textLower = text.toLowerCase();
  let translated = text;
  let matchCount = 0;
  const usedTerms: string[] = [];

  // Sort dictionary keys by length (longest first) to avoid partial matches
  const sortedKeys = Object.keys(COMEX_DICTIONARY).sort((a, b) => b.length - a.length);

  for (const term of sortedKeys) {
    if (textLower.includes(term)) {
      const translations = COMEX_DICTIONARY[term];
      const regex = new RegExp(`\\b${term}\\b`, 'gi');

      // Replace term with Portuguese equivalent
      const replaced = translated.replace(regex, translations[0]);

      if (replaced !== translated) {
        translated = replaced;
        matchCount++;
        usedTerms.push(term);
      }
    }
  }

  // If found matches in dictionary, return with high confidence
  if (matchCount > 0) {
    console.log(`[Translator] Dictionary matched ${matchCount} terms: ${usedTerms.slice(0, 3).join(', ')}${usedTerms.length > 3 ? '...' : ''}`);
    return {
      original: text,
      translated,
      sourceLanguage: detectedLang,
      confidence: 0.9,
      fromCache: false,
    };
  }

  // Step 2: Fallback to Gemini for unknown terms
  console.log(`[Translator] No dictionary match, using Gemini for: "${text.substring(0, 50)}..."`);
  const geminiTranslation = await translateWithGemini(text, detectedLang);

  return {
    original: text,
    translated: geminiTranslation,
    sourceLanguage: detectedLang,
    confidence: 0.75,
    fromCache: false,
  };
}

/**
 * Gemini translation for unknown terms
 * Uses specialized COMEX context
 */
async function translateWithGemini(text: string, sourceLang: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[Translator] GEMINI_API_KEY not configured, returning original text');
    return text;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const langNames: Record<string, string> = {
    en: 'inglês',
    es: 'espanhol',
    zh: 'chinês',
    pt: 'português',
  };

  const prompt = `Você é um tradutor especializado em comércio exterior brasileiro (COMEX).

TAREFA: Traduza o seguinte texto de ${langNames[sourceLang] || 'inglês'} para português brasileiro.

IMPORTANTE:
- Use terminologia oficial de classificação NCM/TIPI da Receita Federal
- Mantenha nomes técnicos quando apropriado (ex: "LCD" permanece "LCD")
- Use português usado em documentos aduaneiros e faturas comerciais
- Seja preciso e técnico, não literário

TEXTO ORIGINAL:
"${text}"

RESPOSTA:
Retorne APENAS a tradução em português, sem explicações ou texto adicional.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const translatedText = response.text().trim();

    console.log(`[Translator] Gemini translated: "${text}" → "${translatedText}"`);
    return translatedText;
  } catch (error: any) {
    console.error('[Translator] Gemini translation failed:', error.message);
    return text; // Fallback to original
  }
}

/**
 * Batch translate multiple descriptions (more efficient)
 */
export async function translateBatch(
  descriptions: string[],
  sourceLanguage?: string
): Promise<TranslationResult[]> {
  const results: TranslationResult[] = [];

  for (const desc of descriptions) {
    const result = await translateForComex(desc, sourceLanguage);
    results.push(result);
  }

  return results;
}
