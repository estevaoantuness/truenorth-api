/**
 * Siscomex XML Exporter Service
 * Generates XML files compatible with Portal Único Siscomex DUIMP format
 */

interface ExportItem {
  sequencial: number;
  ncm: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
  pesoLiquido: number;
  paisOrigem: string;
}

interface ExportData {
  numeroReferencia: string;
  dataEmbarque?: string;
  incoterm: string;
  moeda: string;
  exportador: {
    nome: string;
    pais: string;
  };
  itens: ExportItem[];
  totais: {
    valorMercadoria: number;
    frete: number;
    seguro: number;
  };
}

/**
 * Escapes special XML characters to prevent injection and parsing errors
 */
function escapeXml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Formats a number with 2 decimal places for XML output
 */
function formatDecimal(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '0.00';
  return value.toFixed(2);
}

/**
 * Formats a date to ISO 8601 format (YYYY-MM-DD)
 */
function formatDate(date?: string | Date): string {
  if (!date) {
    return new Date().toISOString().split('T')[0];
  }
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  // Try to parse the date string
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    return new Date().toISOString().split('T')[0];
  }
  return parsed.toISOString().split('T')[0];
}

/**
 * Generates XML for a single item
 */
function generateItemXml(item: ExportItem): string {
  return `    <item>
      <sequencial>${item.sequencial}</sequencial>
      <ncm>${escapeXml(item.ncm)}</ncm>
      <descricao>${escapeXml(item.descricao)}</descricao>
      <quantidade>${item.quantidade || 1}</quantidade>
      <unidade>${escapeXml(item.unidade || 'UN')}</unidade>
      <valorUnitario>${formatDecimal(item.valorUnitario)}</valorUnitario>
      <valorTotal>${formatDecimal(item.valorTotal)}</valorTotal>
      <pesoLiquido>${formatDecimal(item.pesoLiquido)}</pesoLiquido>
      <paisOrigem>${escapeXml(item.paisOrigem)}</paisOrigem>
    </item>`;
}

/**
 * Generates complete DUIMP XML from operation data
 */
export function generateDuimpXml(data: ExportData): string {
  const itemsXml = data.itens.map(generateItemXml).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<duimp xmlns="http://www.truenorth.com.br/duimp" version="1.0">
  <identificacao>
    <numeroReferencia>${escapeXml(data.numeroReferencia)}</numeroReferencia>
    <dataEmbarque>${formatDate(data.dataEmbarque)}</dataEmbarque>
    <incoterm>${escapeXml(data.incoterm || 'FOB')}</incoterm>
    <moeda>${escapeXml(data.moeda || 'USD')}</moeda>
  </identificacao>
  <exportador>
    <nome>${escapeXml(data.exportador.nome)}</nome>
    <pais>${escapeXml(data.exportador.pais)}</pais>
  </exportador>
  <itens>
${itemsXml}
  </itens>
  <totais>
    <valorMercadoria>${formatDecimal(data.totais.valorMercadoria)}</valorMercadoria>
    <frete>${formatDecimal(data.totais.frete)}</frete>
    <seguro>${formatDecimal(data.totais.seguro)}</seguro>
  </totais>
</duimp>`;
}

/**
 * Transforms extracted operation data to export format
 */
export function transformToExportData(dadosExtraidos: any): ExportData {
  const items: ExportItem[] = (dadosExtraidos.items || []).map((item: any, index: number) => ({
    sequencial: index + 1,
    ncm: item.ncm_sugerido || item.ncm || '',
    descricao: item.description || item.descricao || '',
    quantidade: item.quantity || item.quantidade || 1,
    unidade: item.unit || item.unidade || 'UN',
    valorUnitario: item.unit_price || item.valor_unitario || 0,
    valorTotal: item.total_price || item.valor_total || 0,
    pesoLiquido: item.peso_kg || item.peso_liquido || 0,
    paisOrigem: item.origem || dadosExtraidos.supplier?.country || 'CN',
  }));

  // Calculate total value from items if not provided
  const valorMercadoria = dadosExtraidos.total_value ||
    items.reduce((sum, item) => sum + (item.valorTotal || 0), 0);

  return {
    numeroReferencia: dadosExtraidos.invoice_number || 'SEM-NUMERO',
    dataEmbarque: dadosExtraidos.invoice_date || dadosExtraidos.data_embarque,
    incoterm: dadosExtraidos.incoterm || 'FOB',
    moeda: dadosExtraidos.currency || dadosExtraidos.moeda || 'USD',
    exportador: {
      nome: dadosExtraidos.supplier?.name || dadosExtraidos.fornecedor?.nome || 'N/A',
      pais: dadosExtraidos.supplier?.country || dadosExtraidos.fornecedor?.pais || 'CN',
    },
    itens: items,
    totais: {
      valorMercadoria,
      frete: dadosExtraidos.freight || dadosExtraidos.frete || 0,
      seguro: dadosExtraidos.insurance || dadosExtraidos.seguro || 0,
    },
  };
}

/**
 * Validates export data before generating XML
 * Returns array of validation errors (empty if valid)
 */
export function validateExportData(data: ExportData): string[] {
  const errors: string[] = [];

  if (!data.numeroReferencia || data.numeroReferencia === 'SEM-NUMERO') {
    errors.push('Número de referência/invoice não informado');
  }

  if (!data.exportador.nome || data.exportador.nome === 'N/A') {
    errors.push('Nome do exportador não informado');
  }

  if (!data.exportador.pais) {
    errors.push('País do exportador não informado');
  }

  if (!data.itens || data.itens.length === 0) {
    errors.push('Nenhum item para exportar');
  }

  // Validate items
  data.itens.forEach((item, index) => {
    if (!item.ncm || item.ncm.length !== 8) {
      errors.push(`Item ${index + 1}: NCM inválido ou não informado (deve ter 8 dígitos)`);
    }
    if (!item.descricao) {
      errors.push(`Item ${index + 1}: Descrição não informada`);
    }
    if (item.valorTotal <= 0) {
      errors.push(`Item ${index + 1}: Valor não informado`);
    }
  });

  return errors;
}
