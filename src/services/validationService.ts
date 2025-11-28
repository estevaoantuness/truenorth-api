import { NcmDatabase, TipoErro, Anuente } from '@prisma/client';

interface ExtractedData {
  invoice_number?: string;
  invoice_date?: string;
  supplier?: {
    name?: string;
    address?: string;
    country?: string;
  };
  buyer?: {
    name?: string;
    cnpj?: string;
  };
  incoterm?: string;
  currency?: string;
  total_value?: number;
  freight?: number;
  insurance?: number;
  items?: Array<{
    description?: string;
    quantity?: number;
    unit?: string;
    unit_price?: number;
    total_price?: number;
    ncm_sugerido?: string;
    peso_kg?: number;
    origem?: string;
  }>;
}

interface Validacao {
  campo: string;
  valor_encontrado: string | number | null;
  valor_esperado: string | number | null;
  status: 'OK' | 'ALERTA' | 'ERRO';
  codigo_erro?: string;
  explicacao: string;
  fonte: string;
  sugestao_correcao?: string;
}

interface ErroDetectado {
  tipo_erro: string;
  campo: string;
  valor_original: any;
  valor_esperado: any;
  explicacao: string;
  fonte: string;
  custo_estimado?: number;
  severidade?: string;
}

interface ValidationResult {
  validacoes: Validacao[];
  erros: ErroDetectado[];
  dadosValidados: any;
  anuentesNecessarios: string[];
  riscoGeral: 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO';
}

export async function validateOperation(
  dados: ExtractedData,
  ncmDatabase: NcmDatabase[],
  tiposErro: TipoErro[],
  anuentes: Anuente[]
): Promise<ValidationResult> {
  const validacoes: Validacao[] = [];
  const erros: ErroDetectado[] = [];
  const anuentesNecessarios: string[] = [];

  // Create NCM lookup map
  const ncmMap = new Map(ncmDatabase.map((n) => [n.ncm, n]));

  // 1. Validate items and NCMs
  if (dados.items && dados.items.length > 0) {
    for (let i = 0; i < dados.items.length; i++) {
      const item = dados.items[i];
      const itemNum = i + 1;

      // Check if NCM exists
      if (item.ncm_sugerido) {
        const ncmInfo = ncmMap.get(item.ncm_sugerido);

        if (!ncmInfo) {
          // NCM not found in database
          validacoes.push({
            campo: `Item ${itemNum} - NCM`,
            valor_encontrado: item.ncm_sugerido,
            valor_esperado: null,
            status: 'ERRO',
            codigo_erro: 'NCM_INVALIDO',
            explicacao: `NCM ${item.ncm_sugerido} não encontrado na base de dados TIPI`,
            fonte: `Invoice - Item ${itemNum}: "${item.description}"`,
            sugestao_correcao: 'Verifique o código NCM na tabela TIPI ou consulte um especialista em classificação fiscal',
          });

          erros.push({
            tipo_erro: 'NCM_INVALIDO',
            campo: `Item ${itemNum} - NCM`,
            valor_original: item.ncm_sugerido,
            valor_esperado: 'NCM válido de 8 dígitos',
            explicacao: `O código NCM ${item.ncm_sugerido} não existe na Tabela TIPI vigente`,
            fonte: `Invoice linha do item ${itemNum}`,
            severidade: 'MEDIA',
          });
        } else {
          // NCM found - check anuentes
          validacoes.push({
            campo: `Item ${itemNum} - NCM`,
            valor_encontrado: item.ncm_sugerido,
            valor_esperado: item.ncm_sugerido,
            status: 'OK',
            explicacao: `NCM válido: ${ncmInfo.descricao}`,
            fonte: 'Tabela TIPI 2024',
          });

          // Add required anuentes
          if (ncmInfo.anuentes && ncmInfo.anuentes.length > 0) {
            for (const anuente of ncmInfo.anuentes) {
              if (!anuentesNecessarios.includes(anuente)) {
                anuentesNecessarios.push(anuente);
              }
            }

            validacoes.push({
              campo: `Item ${itemNum} - Anuência`,
              valor_encontrado: ncmInfo.anuentes.join(', '),
              valor_esperado: ncmInfo.anuentes.join(', '),
              status: 'ALERTA',
              explicacao: `NCM ${item.ncm_sugerido} requer anuência de: ${ncmInfo.anuentes.join(', ')}`,
              fonte: `Regra NCM na base de dados`,
              sugestao_correcao: `Verificar se LPCO foi solicitado para ${ncmInfo.anuentes.join(', ')}`,
            });
          }

          // Check LPCO requirement
          if (ncmInfo.requerLpco) {
            erros.push({
              tipo_erro: 'LPCO_NAO_DECLARADO',
              campo: `Item ${itemNum} - LPCO`,
              valor_original: 'Não informado',
              valor_esperado: ncmInfo.tipoLpco || 'LPCO',
              explicacao: `NCM ${item.ncm_sugerido} requer ${ncmInfo.tipoLpco || 'LPCO'} para importação`,
              fonte: `Regra NCM ${item.ncm_sugerido} - ${ncmInfo.anuentes.join(', ')}`,
              severidade: 'ALTA',
            });
          }

          // Check for sector mismatch (simplified - check description vs NCM sector)
          const descLower = (item.description || '').toLowerCase();
          const ncmSector = ncmInfo.setor?.toLowerCase() || '';

          // Simple heuristic for sector mismatch
          if (ncmSector === 'cosmeticos' && (descLower.includes('brake') || descLower.includes('freio'))) {
            erros.push({
              tipo_erro: 'NCM_ERRADO_SETOR',
              campo: `Item ${itemNum} - Classificação`,
              valor_original: item.ncm_sugerido,
              valor_esperado: 'NCM de autopeças (cap. 87)',
              explicacao: `Produto "${item.description}" parece ser autopeça mas está classificado como cosmético`,
              fonte: `Análise da descrição vs NCM informado`,
              severidade: 'CRITICA',
            });
          }
        }
      } else {
        // No NCM provided
        validacoes.push({
          campo: `Item ${itemNum} - NCM`,
          valor_encontrado: null,
          valor_esperado: 'NCM de 8 dígitos',
          status: 'ERRO',
          codigo_erro: 'NCM_INVALIDO',
          explicacao: 'NCM não informado para o item',
          fonte: `Invoice - Item ${itemNum}`,
          sugestao_correcao: 'Consulte a tabela TIPI para classificar o produto corretamente',
        });
      }

      // Check for subfaturamento (value/weight ratio)
      if (item.total_price && item.peso_kg && item.peso_kg > 0) {
        const valuePerKg = item.total_price / item.peso_kg;

        // Simple heuristic: if value/kg < 2 USD, might be undervalued
        if (valuePerKg < 2) {
          erros.push({
            tipo_erro: 'NCM_SUBFATURAMENTO',
            campo: `Item ${itemNum} - Valor`,
            valor_original: `USD ${valuePerKg.toFixed(2)}/kg`,
            valor_esperado: 'Valor acima de USD 2.00/kg',
            explicacao: `Razão valor/peso muito baixa (${valuePerKg.toFixed(2)} USD/kg). Possível subfaturamento.`,
            fonte: `Cálculo: ${item.total_price} USD / ${item.peso_kg} kg`,
            severidade: 'CRITICA',
          });
        }
      }
    }
  }

  // 2. Validate document fields
  if (!dados.invoice_number) {
    validacoes.push({
      campo: 'Número da Invoice',
      valor_encontrado: null,
      valor_esperado: 'Número identificador',
      status: 'ALERTA',
      codigo_erro: 'DOC_DESCRICAO_INCOMPLETA',
      explicacao: 'Número da invoice não identificado no documento',
      fonte: 'Análise do documento',
    });
  }

  // 3. Validate incoterm
  const validIncoterms = ['FOB', 'CIF', 'CFR', 'DAP', 'DDP', 'EXW', 'FCA', 'CPT', 'CIP', 'DAT', 'DPU'];
  if (dados.incoterm && !validIncoterms.includes(dados.incoterm.toUpperCase())) {
    validacoes.push({
      campo: 'Incoterm',
      valor_encontrado: dados.incoterm,
      valor_esperado: validIncoterms.join(', '),
      status: 'ERRO',
      codigo_erro: 'INCOTERM_INCONSISTENTE',
      explicacao: `Incoterm "${dados.incoterm}" não é válido`,
      fonte: 'Invoice - Termos comerciais',
    });

    erros.push({
      tipo_erro: 'INCOTERM_INCONSISTENTE',
      campo: 'Incoterm',
      valor_original: dados.incoterm,
      valor_esperado: 'Incoterm válido (FOB, CIF, etc.)',
      explicacao: `O termo comercial "${dados.incoterm}" não é reconhecido como Incoterm válido`,
      fonte: 'Regras Incoterms 2020',
      severidade: 'MEDIA',
    });
  }

  // Determine overall risk level
  let riscoGeral: 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO' = 'BAIXO';

  const criticos = erros.filter((e) => e.severidade === 'CRITICA').length;
  const altos = erros.filter((e) => e.severidade === 'ALTA').length;

  if (criticos > 0) {
    riscoGeral = 'CRITICO';
  } else if (altos > 0) {
    riscoGeral = 'ALTO';
  } else if (erros.length > 0) {
    riscoGeral = 'MEDIO';
  }

  return {
    validacoes,
    erros,
    dadosValidados: dados,
    anuentesNecessarios,
    riscoGeral,
  };
}

export function calculateCosts(
  erros: ErroDetectado[],
  tiposErro: TipoErro[],
  dados: ExtractedData
): {
  custoMultas: number;
  custoDemurrage: number;
  custoTotal: number;
  diasAtrasoEstimado: number;
  detalhamento: Array<{
    erro: string;
    custoMulta: number;
    custoDemurrage: number;
    diasAtraso: number;
    calculo: string;
  }>;
} {
  const tipoErroMap = new Map(tiposErro.map((t) => [t.codigo, t]));
  const valorMercadoria = dados.total_value || 0;

  let custoMultas = 0;
  let custoDemurrage = 0;
  let diasAtrasoTotal = 0;
  const detalhamento: Array<{
    erro: string;
    custoMulta: number;
    custoDemurrage: number;
    diasAtraso: number;
    calculo: string;
  }> = [];

  for (const erro of erros) {
    const tipoErro = tipoErroMap.get(erro.tipo_erro);

    if (tipoErro) {
      // Calculate base cost
      let custoBase = Number(tipoErro.custoBase) || 0;

      // Add percentage if applicable
      if (tipoErro.custoPercentual && valorMercadoria > 0) {
        custoBase += valorMercadoria * (Number(tipoErro.custoPercentual) / 100);
      }

      // Apply maximum cap
      if (tipoErro.custoMaximo) {
        custoBase = Math.min(custoBase, Number(tipoErro.custoMaximo));
      }

      // Calculate demurrage
      const diasAtraso = tipoErro.diasAtrasoMedio || 0;
      const demurrageDiario = Number(tipoErro.demurrageDiario) || 1500;
      const demurrageErro = diasAtraso * demurrageDiario;

      custoMultas += custoBase;
      custoDemurrage += demurrageErro;
      diasAtrasoTotal = Math.max(diasAtrasoTotal, diasAtraso);

      detalhamento.push({
        erro: tipoErro.nome,
        custoMulta: custoBase,
        custoDemurrage: demurrageErro,
        diasAtraso,
        calculo: `Base R$ ${Number(tipoErro.custoBase).toFixed(2)}${
          tipoErro.custoPercentual ? ` + ${tipoErro.custoPercentual}% de R$ ${valorMercadoria.toFixed(2)}` : ''
        } = R$ ${custoBase.toFixed(2)}`,
      });
    }
  }

  return {
    custoMultas,
    custoDemurrage,
    custoTotal: custoMultas + custoDemurrage,
    diasAtrasoEstimado: diasAtrasoTotal,
    detalhamento,
  };
}
