import xml2js from 'xml2js';

interface NFeParsed {
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
    ncm_sugerido: string;
    peso_kg: number | null;
    origem: string | null;
  }>;
  observacoes: string[];
  campos_faltando: string[];
}

export async function parseXML(xmlContent: string): Promise<NFeParsed> {
  return new Promise((resolve, reject) => {
    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: true,
    });

    parser.parseString(xmlContent, (err, result) => {
      if (err) {
        reject(new Error('Erro ao parsear XML: ' + err.message));
        return;
      }

      try {
        // Try to parse as NF-e (Brazilian electronic invoice)
        const nfe = result.nfeProc?.NFe?.infNFe || result.NFe?.infNFe || result.infNFe;

        if (nfe) {
          resolve(parseNFe(nfe));
        } else {
          // Try generic XML parsing
          resolve(parseGenericXML(result));
        }
      } catch (error: any) {
        reject(new Error('Erro ao processar dados do XML: ' + error.message));
      }
    });
  });
}

function parseNFe(nfe: any): NFeParsed {
  const emit = nfe.emit || {};
  const dest = nfe.dest || {};
  const ide = nfe.ide || {};
  const total = nfe.total?.ICMSTot || {};
  const det = nfe.det;

  // Parse items (can be array or single item)
  const detArray = Array.isArray(det) ? det : [det];

  const items = detArray.map((item: any) => {
    const prod = item.prod || {};
    return {
      description: prod.xProd || 'Produto não identificado',
      quantity: parseFloat(prod.qCom) || 1,
      unit: prod.uCom || 'UN',
      unit_price: parseFloat(prod.vUnCom) || 0,
      total_price: parseFloat(prod.vProd) || 0,
      ncm_sugerido: prod.NCM || '',
      peso_kg: parseFloat(prod.pesoL) || null,
      origem: null,
    };
  });

  return {
    invoice_number: nfe['@_Id'] || ide.nNF || 'N/A',
    invoice_date: ide.dhEmi?.split('T')[0] || new Date().toISOString().split('T')[0],
    supplier: {
      name: emit.xNome || emit.xFant || 'Fornecedor não identificado',
      address: formatAddress(emit.enderEmit),
      country: 'Brasil',
    },
    buyer: {
      name: dest.xNome || 'Destinatário não identificado',
      cnpj: dest.CNPJ || dest.CPF || 'N/A',
    },
    incoterm: null,
    currency: 'BRL',
    total_value: parseFloat(total.vNF) || 0,
    freight: parseFloat(total.vFrete) || null,
    insurance: parseFloat(total.vSeg) || null,
    items,
    observacoes: ['Dados extraídos de NF-e'],
    campos_faltando: [],
  };
}

function parseGenericXML(data: any): NFeParsed {
  // Attempt to extract common fields from generic XML
  const flatData = flattenObject(data);

  return {
    invoice_number: findValue(flatData, ['invoice', 'number', 'invoiceNumber', 'nNF']) || 'N/A',
    invoice_date: findValue(flatData, ['date', 'invoiceDate', 'dhEmi']) || new Date().toISOString().split('T')[0],
    supplier: {
      name: findValue(flatData, ['supplier', 'vendor', 'xNome', 'companyName']) || 'Fornecedor não identificado',
      address: findValue(flatData, ['address', 'endereco']) || 'N/A',
      country: findValue(flatData, ['country', 'pais']) || 'N/A',
    },
    buyer: {
      name: findValue(flatData, ['buyer', 'customer', 'destinatario']) || 'N/A',
      cnpj: findValue(flatData, ['cnpj', 'taxId']) || 'N/A',
    },
    incoterm: findValue(flatData, ['incoterm', 'terms']) || null,
    currency: findValue(flatData, ['currency', 'moeda']) || 'USD',
    total_value: parseFloat(findValue(flatData, ['total', 'totalValue', 'vNF']) || '0'),
    freight: null,
    insurance: null,
    items: [{
      description: 'Item genérico do XML',
      quantity: 1,
      unit: 'UN',
      unit_price: 0,
      total_price: 0,
      ncm_sugerido: '',
      peso_kg: null,
      origem: null,
    }],
    observacoes: ['XML genérico - estrutura pode não estar completa'],
    campos_faltando: ['Estrutura XML não reconhecida completamente'],
  };
}

function formatAddress(endereco: any): string {
  if (!endereco) return 'N/A';

  const parts = [
    endereco.xLgr,
    endereco.nro,
    endereco.xBairro,
    endereco.xMun,
    endereco.UF,
    endereco.CEP,
  ].filter(Boolean);

  return parts.join(', ') || 'N/A';
}

function flattenObject(obj: any, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};

  for (const key in obj) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(result, flattenObject(obj[key], newKey));
    } else {
      result[newKey.toLowerCase()] = String(obj[key]);
    }
  }

  return result;
}

function findValue(obj: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    for (const objKey in obj) {
      if (objKey.toLowerCase().includes(key.toLowerCase())) {
        return obj[objKey];
      }
    }
  }
  return undefined;
}
