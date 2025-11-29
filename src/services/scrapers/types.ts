/**
 * Types for the two-stage extraction pipeline
 * Stage 1: Scraper - extracts raw data (Groq/cheap model)
 * Stage 2: Analyst - classifies and enriches with DB (GPT-4o)
 */

/**
 * Raw extraction result from scraper (no NCM classification)
 */
export interface RawExtractionResult {
  invoice_number?: string;
  invoice_date?: string;
  supplier_name?: string;
  supplier_address?: string;
  supplier_country?: string;
  buyer_name?: string;
  buyer_cnpj?: string;
  incoterm?: string;
  currency?: string;
  total_value?: number;
  freight?: number;
  insurance?: number;
  items: Array<{
    description: string;
    quantity?: number;
    unit?: string;
    unit_price?: number;
    total_price?: number;
    weight_kg?: number;
    origin_country?: string;
  }>;
  observations?: string[];
  missing_fields?: string[];
  confidence_score?: number;
}

/**
 * Final classified result from analyst (with NCM and anuentes)
 */
export interface ClassifiedExtractionResult {
  invoice_number: string;
  invoice_date: string;
  supplier: {
    name: string;
    address: string;
    country: string;
  };
  buyer: {
    name: string;
    cnpj: string;
  };
  incoterm: string | null;
  currency: string;
  total_value: number;
  freight: number | null;
  insurance: number | null;
  items: Array<{
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    total_price: number;
    ncm_sugerido: string | null;
    ncm_descricao?: string;
    ncm_confianca?: 'ALTA' | 'MEDIA' | 'BAIXA';
    peso_kg: number | null;
    origem: string | null;
    anuentes_necessarios?: string[];
  }>;
  observacoes: string[];
  campos_faltando: string[];
  setor_detectado?: string;
  anuentes_operacao?: string[];
  feedback_especialista?: string;
}

/**
 * Interface for scraper providers (Groq, OpenAI, etc.)
 */
export interface ScraperProvider {
  name: string;

  /**
   * Extract raw data from document text
   */
  extractFromText(text: string): Promise<RawExtractionResult>;

  /**
   * Extract raw data from image (for scanned documents)
   */
  extractFromImage(imageBuffer: Buffer, mimeType: string): Promise<RawExtractionResult>;

  /**
   * Check if provider supports image extraction
   */
  supportsImageExtraction(): boolean;
}

/**
 * Available scraper provider types
 */
export type ScraperProviderType = 'groq' | 'openai' | 'gemini';

/**
 * Database context for the analyst
 */
export interface DatabaseContext {
  ncms: Array<{
    codigo: string;
    descricao: string;
    aliquotaIi: string;
    aliquotaIpi: string;
    setor: string;
    anuentes: string[];
  }>;
  anuentes: Array<{
    sigla: string;
    nomeCompleto: string;
    descricao: string;
  }>;
}
