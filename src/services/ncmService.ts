/**
 * NCM Service - Intelligent NCM lookup with database + API fallback
 *
 * Strategy:
 * 1. Search local PostgreSQL (15,000+ NCMs from Siscomex/TIPI)
 * 2. Fallback to Siscomex API if not found
 * 3. Cache new NCMs in local database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface NcmInfo {
  ncm: string;
  descricao: string;
  capitulo: string;
  aliquotaIi: number;
  aliquotaIpi: number;
  aliquotaPis: number;
  aliquotaCofins: number;
  anuentes: string[];
  requerLpco: boolean;
  setor: string;
  fonte: string;
}

export interface NcmSearchResult {
  ncm: string;
  descricao: string;
  setor: string;
  score: number;
}

/**
 * COMEX Synonym Dictionary
 * Maps single words to their NCM equivalents (single words only, no phrases)
 */
const COMEX_SYNONYMS: Record<string, string[]> = {
  // Autopeças
  'pastilha': ['guarnição'],
  'pastilhas': ['guarnições'],
  'guarnição': ['pastilha'],
  'freio': ['travão', 'servofreio'],
  'freios': ['travões', 'servofreios'],
  'disco': ['prato'],

  // Eletrônicos
  'fone': ['auricular', 'auscultador'],
  'fones': ['auriculares', 'auscultadores'],
  'bateria': ['acumulador'],
  'baterias': ['acumuladores'],
  'carregador': ['fonte'],
  'lítio': ['íon'],
  'portátil': ['recarregável'],

  // Alimentos
  'extravirgem': ['virgem'],
  'refinado': ['processado'],
  'soja': ['soya'],

  // Cosméticos
  'perfume': ['fragrância'],
  'creme': ['preparação'], // Removed 'pomada' to avoid food confusion
  'facial': ['pele', 'rosto'],
  'anti': ['contra'],
};

/**
 * Expand query with single-word synonyms only
 * Multi-word synonyms cause tsquery syntax errors
 */
function expandQueryWithSynonyms(query: string): string {
  const queryLower = query.toLowerCase();
  const words = queryLower.split(/\s+/).filter(w => w.length >= 2);

  const expandedWords = words.map(word => {
    const synonyms = COMEX_SYNONYMS[word];

    if (synonyms && synonyms.length > 0) {
      // Create OR group: (word | syn1 | syn2)
      const allTerms = [word, ...synonyms];
      return `(${allTerms.join('|')})`;
    }

    return word;
  });

  // Join with OR for better recall (match ANY word)
  return expandedWords.join('|');
}

/**
 * Get NCM info by exact code
 */
export async function getNcmInfo(ncm: string): Promise<NcmInfo | null> {
  // Normalize NCM (remove dots, ensure 8 digits)
  const normalizedNcm = ncm.replace(/\D/g, '').padEnd(8, '0').slice(0, 8);

  // Try local database first (fast - ~5ms)
  const localResult = await prisma.ncmDatabase.findUnique({
    where: { ncm: normalizedNcm },
  });

  if (localResult) {
    return {
      ncm: localResult.ncm,
      descricao: localResult.descricao,
      capitulo: localResult.capitulo || localResult.ncm.slice(0, 2),
      aliquotaIi: localResult.aliquotaIi?.toNumber() || 0,
      aliquotaIpi: localResult.aliquotaIpi?.toNumber() || 0,
      aliquotaPis: localResult.aliquotaPis?.toNumber() || 2.1,
      aliquotaCofins: localResult.aliquotaCofins?.toNumber() || 9.65,
      anuentes: localResult.anuentes || [],
      requerLpco: localResult.requerLpco || false,
      setor: localResult.setor || 'Outros',
      fonte: localResult.fonte || 'database',
    };
  }

  // Fallback: Try Siscomex API (if not in local DB)
  console.log(`[NCM Service] NCM ${normalizedNcm} not found locally, trying Siscomex API...`);

  try {
    const apiResult = await fetchFromSiscomexApi(normalizedNcm);
    if (apiResult) {
      // Cache in local database for future queries
      await cacheNcmInDatabase(apiResult);
      return apiResult;
    }
  } catch (error) {
    console.error('[NCM Service] Siscomex API fallback failed:', error);
  }

  return null;
}

/**
 * Search NCMs by description using PostgreSQL Full-Text Search
 *
 * Uses native FTS with Portuguese dictionary for accurate semantic matching
 */
export async function searchNcmByDescription(
  query: string,
  sector?: string,
  limit: number = 50
): Promise<NcmSearchResult[]> {
  const normalizedQuery = query.toLowerCase().trim();

  // If query is empty, return empty results
  if (!normalizedQuery || normalizedQuery.length < 3) {
    return [];
  }

  try {
    // Build sector filter with bonus multiplier
    const sectorFilter = sector && sector !== 'Geral' ? `AND setor = '${sector}'` : '';
    const sectorBonus = sector && sector !== 'Geral' ? `
      CASE WHEN setor = '${sector}' THEN 3.0 ELSE 1.0 END
    ` : '1.0';

    // Expand query with synonyms
    const expandedQuery = expandQueryWithSynonyms(normalizedQuery);

    console.log(`[NCM FTS] Query: "${normalizedQuery}" → Expanded: "${expandedQuery}"`);

    // Use to_tsquery with synonyms + improved ranking
    const ftsResults = await prisma.$queryRawUnsafe<Array<{
      ncm: string;
      descricao: string;
      setor: string | null;
      relevance: number;
    }>>(`
      SELECT
        ncm,
        descricao,
        setor,
        ${sectorBonus} *
        ts_rank(descricao_tsvector, query, 32) *
        CASE
          WHEN ncm NOT LIKE '%00%00' THEN 2.0
          WHEN ncm NOT LIKE '%00' THEN 1.5
          ELSE 1.0
        END as relevance
      FROM
        ncm_database,
        to_tsquery('portuguese', '${expandedQuery}') query
      WHERE
        descricao_tsvector @@ query
        ${sectorFilter}
      ORDER BY
        relevance DESC
      LIMIT ${limit}
    `);

    const ftsResultsMapped = ftsResults.map((r) => ({
      ncm: r.ncm,
      descricao: r.descricao,
      setor: r.setor || 'Outros',
      score: r.relevance * 100, // Scale to 0-100 range
    }));

    // Hybrid fallback: If FTS has low confidence, merge with ILIKE results
    const hasLowConfidence =
      ftsResultsMapped.length < 3 ||
      (ftsResultsMapped.length > 0 && ftsResultsMapped[0].score < 3.0);

    if (hasLowConfidence) {
      console.log('[NCM FTS] Low confidence detected, using hybrid FTS+ILIKE approach');

      // Get ILIKE results
      const ilikeResults = await searchWithILIKE(normalizedQuery, sector, limit);

      // Merge and deduplicate
      const mergedResults = [...ftsResultsMapped, ...ilikeResults];
      const uniqueResults = deduplicateByNCM(mergedResults);

      // Re-sort by score and limit
      return uniqueResults
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    }

    return ftsResultsMapped;

  } catch (error: any) {
    // Fallback to ILIKE search if FTS fails (e.g., column doesn't exist yet)
    console.warn('[NCM Service] Full-text search failed, using ILIKE fallback:', error.message);
    return await searchWithILIKE(normalizedQuery, sector, limit);
  }
}

/**
 * Deduplicate NCM results by code, keeping the one with higher score
 */
function deduplicateByNCM(results: NcmSearchResult[]): NcmSearchResult[] {
  const seen = new Map<string, NcmSearchResult>();

  for (const result of results) {
    const existing = seen.get(result.ncm);
    if (!existing || result.score > existing.score) {
      seen.set(result.ncm, result);
    }
  }

  return Array.from(seen.values());
}

/**
 * Search NCMs using ILIKE (fallback method)
 */
async function searchWithILIKE(
  query: string,
  sector?: string,
  limit: number = 50
): Promise<NcmSearchResult[]> {
  const queryLower = query.toLowerCase();
  const words = queryLower.split(/\s+/).filter((w) => w.length >= 3);

  const whereConditions: any[] = words.map((word) => ({
    descricao: { contains: word, mode: 'insensitive' },
  }));

  const where = {
    AND: [
      { OR: whereConditions.length > 0 ? whereConditions : [{}] },
      sector && sector !== 'Geral' ? { setor: sector } : {},
    ],
  };

  const results = await prisma.ncmDatabase.findMany({
    where,
    take: limit * 2,
    select: { ncm: true, descricao: true, setor: true },
  });

  const scored = results.map((r) => {
    let score = 0;
    const descLower = r.descricao.toLowerCase();

    if (descLower.includes(queryLower)) score += 100;
    words.forEach((word) => {
      if (descLower.includes(word)) score += 20;
    });
    if (sector && r.setor === sector) score += 30;
    if (!r.ncm.endsWith('00')) score += 10;

    return { ...r, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => ({
      ncm: r.ncm,
      descricao: r.descricao,
      setor: r.setor || 'Outros',
      score: r.score,
    }));
}

/**
 * Get NCMs for a specific sector (for analyst context)
 */
export async function getNcmsBySector(
  sector: string,
  limit: number = 100
): Promise<NcmSearchResult[]> {
  const results = await prisma.ncmDatabase.findMany({
    where: sector !== 'Geral' ? { setor: sector } : {},
    take: limit,
    select: {
      ncm: true,
      descricao: true,
      setor: true,
      aliquotaIi: true,
      aliquotaIpi: true,
      anuentes: true,
    },
    orderBy: { ncm: 'asc' },
  });

  return results.map((r) => ({
    ncm: r.ncm,
    descricao: r.descricao,
    setor: r.setor || 'Outros',
    score: 100, // All equal when filtering by sector
  }));
}

/**
 * Validate if an NCM exists in the database
 */
export async function validateNcm(ncm: string): Promise<{
  valid: boolean;
  exists: boolean;
  info: NcmInfo | null;
  suggestions?: NcmSearchResult[];
}> {
  const normalizedNcm = ncm.replace(/\D/g, '').padEnd(8, '0').slice(0, 8);

  // Check format
  if (!/^\d{8}$/.test(normalizedNcm)) {
    return {
      valid: false,
      exists: false,
      info: null,
    };
  }

  // Try to get info
  const info = await getNcmInfo(normalizedNcm);

  if (info) {
    return {
      valid: true,
      exists: true,
      info,
    };
  }

  // Not found - suggest similar NCMs
  const capitulo = normalizedNcm.slice(0, 2);
  const suggestions = await prisma.ncmDatabase.findMany({
    where: { capitulo },
    take: 5,
    select: {
      ncm: true,
      descricao: true,
      setor: true,
    },
  });

  return {
    valid: false,
    exists: false,
    info: null,
    suggestions: suggestions.map((s) => ({
      ncm: s.ncm,
      descricao: s.descricao,
      setor: s.setor || 'Outros',
      score: 50,
    })),
  };
}

/**
 * Get database statistics
 */
export async function getNcmStats(): Promise<{
  total: number;
  bySector: Record<string, number>;
  withAnuentes: number;
  lastUpdated: Date | null;
}> {
  const total = await prisma.ncmDatabase.count();

  const bySectorRaw = await prisma.ncmDatabase.groupBy({
    by: ['setor'],
    _count: { ncm: true },
  });

  const bySector: Record<string, number> = {};
  bySectorRaw.forEach((s) => {
    bySector[s.setor || 'Outros'] = s._count.ncm;
  });

  const withAnuentes = await prisma.ncmDatabase.count({
    where: {
      NOT: { anuentes: { isEmpty: true } },
    },
  });

  const latest = await prisma.ncmDatabase.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: { updatedAt: true },
  });

  return {
    total,
    bySector,
    withAnuentes,
    lastUpdated: latest?.updatedAt || null,
  };
}

// ============ Private Helper Functions ============

// Interface for Siscomex API response
interface SiscomexApiResponse {
  codigo?: string;
  descricao?: string;
  nomeNCM?: string;
  aliquotaII?: string | number;
  aliquotaIPI?: string | number;
  anuentes?: string[];
}

/**
 * Fetch NCM from Siscomex API (fallback)
 */
async function fetchFromSiscomexApi(ncm: string): Promise<NcmInfo | null> {
  try {
    const response = await fetch(
      `https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/${ncm}`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'TrueNorth-API/1.0',
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as SiscomexApiResponse;

    if (!data || !data.codigo) {
      return null;
    }

    // Map Siscomex response to our format
    return {
      ncm: data.codigo,
      descricao: data.descricao || data.nomeNCM || '',
      capitulo: ncm.slice(0, 2),
      aliquotaIi: parseFloat(String(data.aliquotaII)) || 0,
      aliquotaIpi: parseFloat(String(data.aliquotaIPI)) || 0,
      aliquotaPis: 2.1, // Default
      aliquotaCofins: 9.65, // Default
      anuentes: data.anuentes || [],
      requerLpco: (data.anuentes || []).length > 0,
      setor: detectSectorFromDescription(data.descricao || ''),
      fonte: 'Siscomex-API',
    };
  } catch (error) {
    console.error('[NCM Service] Siscomex API error:', error);
    return null;
  }
}

/**
 * Cache NCM in local database
 */
async function cacheNcmInDatabase(ncmInfo: NcmInfo): Promise<void> {
  try {
    await prisma.ncmDatabase.upsert({
      where: { ncm: ncmInfo.ncm },
      update: {
        descricao: ncmInfo.descricao,
        aliquotaIi: ncmInfo.aliquotaIi,
        aliquotaIpi: ncmInfo.aliquotaIpi,
        aliquotaPis: ncmInfo.aliquotaPis,
        aliquotaCofins: ncmInfo.aliquotaCofins,
        anuentes: ncmInfo.anuentes,
        requerLpco: ncmInfo.requerLpco,
        setor: ncmInfo.setor,
        fonte: ncmInfo.fonte,
      },
      create: {
        ncm: ncmInfo.ncm,
        descricao: ncmInfo.descricao,
        capitulo: ncmInfo.capitulo,
        aliquotaIi: ncmInfo.aliquotaIi,
        aliquotaIpi: ncmInfo.aliquotaIpi,
        aliquotaPis: ncmInfo.aliquotaPis,
        aliquotaCofins: ncmInfo.aliquotaCofins,
        anuentes: ncmInfo.anuentes,
        requerLpco: ncmInfo.requerLpco,
        setor: ncmInfo.setor,
        fonte: ncmInfo.fonte,
      },
    });
    console.log(`[NCM Service] Cached NCM ${ncmInfo.ncm} from API`);
  } catch (error) {
    console.error('[NCM Service] Failed to cache NCM:', error);
  }
}

/**
 * Detect sector from description (simple heuristics)
 */
function detectSectorFromDescription(descricao: string): string {
  const desc = descricao.toLowerCase();

  const sectorKeywords: Record<string, string[]> = {
    Eletronicos: ['eletr', 'circuit', 'celular', 'telefone', 'computador', 'led'],
    Alimentos: ['aliment', 'comest', 'bebida', 'carne', 'peixe', 'fruta'],
    Quimicos: ['quim', 'acid', 'solvente', 'polimer', 'resina'],
    Farmaceuticos: ['medic', 'farmac', 'vacina', 'soro'],
    Cosmeticos: ['cosmet', 'perfum', 'shampoo', 'creme'],
    Textil: ['textil', 'tecido', 'algodao', 'poliester', 'roupa'],
    Autopecas: ['veicul', 'automo', 'motor', 'freio', 'transmiss'],
    Maquinas: ['maquina', 'equipamento', 'industrial', 'bomba', 'valvula'],
    Metais: ['metal', 'ferro', 'aco', 'aluminio', 'cobre'],
  };

  for (const [sector, keywords] of Object.entries(sectorKeywords)) {
    if (keywords.some((kw) => desc.includes(kw))) {
      return sector;
    }
  }

  return 'Outros';
}
