/**
 * End-to-End Tests with Real Invoice Scenarios
 *
 * Testa o pipeline completo: tradução → detecção de setor → classificação NCM
 *
 * Run: npx ts-node tests/e2e/real-invoice-tests.ts
 */

import { translateForComex, detectLanguage } from '../../src/services/translatorService';
import { searchNcmByDescription, searchWithAutoRetry } from '../../src/services/ncmService';

// ============================================
// INVOICES REALISTAS (baseadas em casos comuns)
// ============================================

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  language: 'en' | 'pt' | 'zh';
  expectedSector?: string;
  expectedNCM?: string;
  notes?: string;
}

interface Invoice {
  id: string;
  country: string;
  scenario: string;
  items: InvoiceItem[];
}

const REAL_INVOICES: Invoice[] = [
  // ========================================
  // CASO 1: Invoice chinesa de eletrônicos (muito comum)
  // ========================================
  {
    id: 'INV-CN-001',
    country: 'China',
    scenario: 'E-commerce: AliExpress/Alibaba - Eletrônicos de consumo',
    items: [
      {
        description: 'Wireless Bluetooth Earbuds TWS 5.0 with Charging Case',
        quantity: 500,
        unitPrice: 12.50,
        language: 'en',
        expectedSector: 'Eletronicos',
        expectedNCM: '85183000', // Fones de ouvido
        notes: 'Produto típico de importação chinesa'
      },
      {
        description: 'Portable Power Bank 20000mAh Lithium Polymer Battery',
        quantity: 300,
        unitPrice: 18.00,
        language: 'en',
        expectedSector: 'Eletronicos',
        expectedNCM: '85076000', // Acumuladores de lítio
        notes: 'Requer homologação ANATEL'
      },
      {
        description: 'USB-C Fast Charging Cable 2M Nylon Braided',
        quantity: 1000,
        unitPrice: 3.50,
        language: 'en',
        expectedSector: 'Eletronicos',
        notes: 'Acessório comum'
      }
    ]
  },

  // ========================================
  // CASO 2: Invoice alemã de autopeças (B2B)
  // ========================================
  {
    id: 'INV-DE-002',
    country: 'Germany',
    scenario: 'B2B: Importação de autopeças premium para revenda',
    items: [
      {
        description: 'Ceramic Brake Pads for Mercedes-Benz C-Class W205',
        quantity: 100,
        unitPrice: 85.00,
        language: 'en',
        expectedSector: 'Autopecas',
        expectedNCM: '87083010', // Guarnições de freio
        notes: 'Pastilhas de freio - termo comum no Brasil'
      },
      {
        description: 'Engine Oil Filter for BMW 3 Series F30',
        quantity: 200,
        unitPrice: 12.00,
        language: 'en',
        expectedSector: 'Autopecas',
        expectedNCM: '84212300', // Filtros de óleo
        notes: 'Filtro automotivo'
      },
      {
        description: 'Front Brake Disc Rotor 320mm Ventilated',
        quantity: 50,
        unitPrice: 120.00,
        language: 'en',
        expectedSector: 'Autopecas',
        expectedNCM: '87083000', // Discos/freios genérico
        notes: 'Disco de freio'
      }
    ]
  },

  // ========================================
  // CASO 3: Invoice italiana de alimentos (alto controle MAPA/ANVISA)
  // ========================================
  {
    id: 'INV-IT-003',
    country: 'Italy',
    scenario: 'Importação de alimentos gourmet - controles sanitários',
    items: [
      {
        description: 'Extra Virgin Olive Oil DOP Toscana 500ml Glass Bottle',
        quantity: 500,
        unitPrice: 22.00,
        language: 'en',
        expectedSector: 'Alimentos',
        expectedNCM: '15092000', // Azeite extra virgem
        notes: 'Requer registro MAPA, rastreabilidade DOP'
      },
      {
        description: 'Balsamic Vinegar of Modena IGP Aged 12 years',
        quantity: 200,
        unitPrice: 35.00,
        language: 'en',
        expectedSector: 'Alimentos',
        notes: 'Produto gourmet com IGP'
      },
      {
        description: 'Parmigiano Reggiano DOP 24 months matured wheel',
        quantity: 20,
        unitPrice: 450.00,
        language: 'en',
        expectedSector: 'Alimentos',
        notes: 'Queijo DOP - controle sanitário rígido'
      }
    ]
  },

  // ========================================
  // CASO 4: Invoice francesa de cosméticos (ANVISA)
  // ========================================
  {
    id: 'INV-FR-004',
    country: 'France',
    scenario: 'Cosméticos de luxo - alta valoração e controle ANVISA',
    items: [
      {
        description: 'Anti-Aging Face Cream with Hyaluronic Acid 50ml',
        quantity: 300,
        unitPrice: 95.00,
        language: 'en',
        expectedSector: 'Cosmeticos',
        expectedNCM: '33049910', // Cremes de beleza
        notes: 'Requer registro ANVISA, alto valor agregado'
      },
      {
        description: 'Eau de Parfum Luxury Fragrance for Women 100ml',
        quantity: 150,
        unitPrice: 180.00,
        language: 'en',
        expectedSector: 'Cosmeticos',
        expectedNCM: '33030010', // Perfumes
        notes: 'Produto de luxo - atenção subfaturamento'
      },
      {
        description: 'Organic Argan Oil Hair Treatment Serum',
        quantity: 400,
        unitPrice: 42.00,
        language: 'en',
        expectedSector: 'Cosmeticos',
        notes: 'Produto orgânico certificado'
      }
    ]
  },

  // ========================================
  // CASO 5: Invoice americana de equipamentos industriais (ex-tarifário potencial)
  // ========================================
  {
    id: 'INV-US-005',
    country: 'USA',
    scenario: 'Máquinas industriais - potencial ex-tarifário',
    items: [
      {
        description: 'CNC Milling Machine 3-Axis Desktop Model XYZ-3000',
        quantity: 2,
        unitPrice: 8500.00,
        language: 'en',
        expectedSector: 'Maquinas',
        notes: 'Alta valoração, possível ex-tarifário'
      },
      {
        description: 'Industrial Air Compressor 50HP 200PSI Oil-Free',
        quantity: 1,
        unitPrice: 12000.00,
        language: 'en',
        expectedSector: 'Maquinas',
        notes: 'Equipamento industrial pesado'
      }
    ]
  },

  // ========================================
  // CASO 6: Invoice com descrições mistas PT/EN (erro comum)
  // ========================================
  {
    id: 'INV-MX-006',
    country: 'Mexico',
    scenario: 'Invoice mal formatada com PT/EN misturado',
    items: [
      {
        description: 'Smartphone Samsung Galaxy latest model',
        quantity: 50,
        unitPrice: 450.00,
        language: 'en',
        expectedSector: 'Eletronicos',
        expectedNCM: '85171300', // Smartphones
        notes: 'Descrição genérica - risco subfaturamento'
      },
      {
        description: 'Laptop Dell Inspiron 15" Intel Core i7 16GB RAM',
        quantity: 30,
        unitPrice: 850.00,
        language: 'en',
        expectedSector: 'Eletronicos',
        notes: 'Especificação técnica detalhada'
      }
    ]
  },

  // ========================================
  // CASO 7: Invoice com termos técnicos químicos/farmacêuticos
  // ========================================
  {
    id: 'INV-CH-007',
    country: 'Switzerland',
    scenario: 'Produtos farmacêuticos/químicos - múltiplos anuentes',
    items: [
      {
        description: 'Pharmaceutical Grade Hyaluronic Acid Powder 99% Purity',
        quantity: 100,
        unitPrice: 220.00,
        language: 'en',
        expectedSector: 'Quimicos',
        notes: 'Requer ANVISA, possível MAPA se uso veterinário'
      },
      {
        description: 'Medical Syringes 10ml Sterile Disposable Luer Lock',
        quantity: 5000,
        unitPrice: 0.35,
        language: 'en',
        expectedSector: 'Medico',
        notes: 'Produto médico - ANVISA obrigatório'
      }
    ]
  }
];

// ============================================
// FUNÇÃO DE TESTE
// ============================================

interface TestResult {
  invoiceId: string;
  item: InvoiceItem;
  translatedDescription: string;
  detectedSector?: string;
  topNCMs: Array<{ ncm: string; descricao: string; score: number }>;
  matchedExpected: boolean;
  rank?: number;
  insights: string[];
}

async function testInvoice(invoice: Invoice): Promise<TestResult[]> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📋 INVOICE: ${invoice.id} - ${invoice.country}`);
  console.log(`📝 Cenário: ${invoice.scenario}`);
  console.log(`${'='.repeat(80)}\n`);

  const results: TestResult[] = [];

  for (const item of invoice.items) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`🔍 Item: ${item.description}`);
    console.log(`   Qty: ${item.quantity} | Unit Price: $${item.unitPrice}`);
    if (item.notes) {
      console.log(`   📌 Nota: ${item.notes}`);
    }

    const insights: string[] = [];

    // 1. Tradução (se necessário)
    let translatedDesc = item.description;
    if (item.language !== 'pt') {
      try {
        console.log(`\n   [1/3] Traduzindo ${item.language.toUpperCase()} → PT...`);
        const translationResult = await translateForComex(item.description, item.language);
        translatedDesc = translationResult.translated;
        console.log(`   ✅ Traduzido: "${translatedDesc}"`);

        // Insight: qualidade da tradução
        if (translatedDesc.toLowerCase() === item.description.toLowerCase()) {
          insights.push('⚠️  Tradução não modificou o texto - possível falha');
        }

        // Mostrar confiança da tradução
        console.log(`   🎯 Confiança: ${(translationResult.confidence * 100).toFixed(1)}% | Cache: ${translationResult.fromCache ? 'Sim' : 'Não'}`);
      } catch (error: any) {
        console.log(`   ❌ Erro na tradução: ${error.message}`);
        insights.push(`❌ Tradução falhou: ${error.message}`);
      }
    }

    // 2. Busca NCM (with auto-retry)
    try {
      console.log(`\n   [2/3] Buscando NCM com auto-retry...`);
      const searchResults = await searchWithAutoRetry(
        translatedDesc,
        item.expectedSector,
        item.language
      );

      if (searchResults.length === 0) {
        console.log(`   ❌ Nenhum NCM encontrado!`);
        insights.push('❌ CRÍTICO: Nenhum NCM encontrado - query muito específica?');
      } else {
        console.log(`\n   📊 Top 5 NCMs encontrados:\n`);
        searchResults.slice(0, 5).forEach((r, i) => {
          const match = r.ncm === item.expectedNCM ? '✅' : '  ';
          console.log(`   ${match} ${i + 1}. NCM ${r.ncm} (score: ${r.score.toFixed(2)}) - ${r.setor}`);
          console.log(`      ${r.descricao.substring(0, 70)}...`);
        });

        // Análise de qualidade
        const topScore = searchResults[0].score;
        if (topScore < 5.0) {
          insights.push(`⚠️  Score baixo (${topScore.toFixed(2)}) - baixa confiança`);
        }

        // Verificar diversidade de setores
        const uniqueSectors = new Set(searchResults.slice(0, 5).map(r => r.setor));
        if (uniqueSectors.size > 2) {
          insights.push(`⚠️  Múltiplos setores nos top 5 (${Array.from(uniqueSectors).join(', ')}) - ambiguidade`);
        }
      }

      // 3. Validação
      let matchedExpected = false;
      let rank: number | undefined;

      if (item.expectedNCM) {
        const foundIndex = searchResults.findIndex(r => r.ncm === item.expectedNCM);
        matchedExpected = foundIndex !== -1;
        rank = foundIndex !== -1 ? foundIndex + 1 : undefined;

        console.log(`\n   [3/3] Validação:`);
        if (matchedExpected) {
          console.log(`   ✅ NCM esperado (${item.expectedNCM}) encontrado no rank ${rank}`);
          if (rank && rank > 3) {
            insights.push(`⚠️  NCM correto mas em rank baixo (${rank}) - pode confundir usuário`);
          }
        } else {
          console.log(`   ❌ NCM esperado (${item.expectedNCM}) NÃO encontrado no top 10`);
          insights.push(`❌ NCM esperado não encontrado - problema no ranking ou tradução`);
        }
      }

      // Insights adicionais
      if (item.notes?.includes('ANVISA') || item.notes?.includes('MAPA')) {
        const hasAnuentes = searchResults[0]?.descricao.toLowerCase().includes('anuis');
        if (!hasAnuentes) {
          insights.push(`⚠️  Item requer anuente (${item.notes}) mas NCM top não indica`);
        }
      }

      results.push({
        invoiceId: invoice.id,
        item,
        translatedDescription: translatedDesc,
        topNCMs: searchResults.slice(0, 5).map(r => ({
          ncm: r.ncm,
          descricao: r.descricao,
          score: r.score
        })),
        matchedExpected,
        rank,
        insights
      });

    } catch (error: any) {
      console.log(`   ❌ Erro na busca: ${error.message}`);
      insights.push(`❌ Busca NCM falhou: ${error.message}`);

      results.push({
        invoiceId: invoice.id,
        item,
        translatedDescription: translatedDesc,
        topNCMs: [],
        matchedExpected: false,
        insights
      });
    }

    // Mostrar insights
    if (insights.length > 0) {
      console.log(`\n   💡 Insights:`);
      insights.forEach(i => console.log(`      ${i}`));
    }
  }

  return results;
}

// ============================================
// EXECUTAR TESTES
// ============================================

async function runRealInvoiceTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║                TESTES END-TO-END COM INVOICES REAIS                    ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝');

  const allResults: TestResult[] = [];

  for (const invoice of REAL_INVOICES) {
    const results = await testInvoice(invoice);
    allResults.push(...results);
  }

  // ============================================
  // ANÁLISE CONSOLIDADA
  // ============================================

  console.log(`\n\n${'═'.repeat(80)}`);
  console.log('                       ANÁLISE CONSOLIDADA');
  console.log(`${'═'.repeat(80)}\n`);

  const totalItems = allResults.length;
  const itemsWithExpected = allResults.filter(r => r.item.expectedNCM).length;
  const matched = allResults.filter(r => r.matchedExpected).length;
  const accuracy = itemsWithExpected > 0 ? (matched / itemsWithExpected * 100) : 0;

  console.log(`📊 Estatísticas Gerais:`);
  console.log(`   • Total de itens testados: ${totalItems}`);
  console.log(`   • Itens com NCM esperado: ${itemsWithExpected}`);
  console.log(`   • NCMs encontrados corretamente: ${matched}/${itemsWithExpected}`);
  console.log(`   • Taxa de acerto: ${accuracy.toFixed(1)}%\n`);

  // Ranking distribution
  const rankings = allResults.filter(r => r.rank).map(r => r.rank!);
  if (rankings.length > 0) {
    console.log(`📈 Distribuição de Rankings (quando encontrado):`);
    console.log(`   • Rank 1: ${rankings.filter(r => r === 1).length} itens`);
    console.log(`   • Rank 2-3: ${rankings.filter(r => r >= 2 && r <= 3).length} itens`);
    console.log(`   • Rank 4-5: ${rankings.filter(r => r >= 4 && r <= 5).length} itens`);
    console.log(`   • Rank 6-10: ${rankings.filter(r => r > 5).length} itens\n`);
  }

  // Insights mais comuns
  const allInsights = allResults.flatMap(r => r.insights);
  const insightCounts: Record<string, number> = {};
  allInsights.forEach(i => {
    const key = i.split(':')[0]; // Pega só o tipo de insight
    insightCounts[key] = (insightCounts[key] || 0) + 1;
  });

  console.log(`🔍 Problemas Mais Frequentes:`);
  Object.entries(insightCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([insight, count]) => {
      console.log(`   • ${insight}: ${count}x`);
    });

  // Items sem resultados
  const noResults = allResults.filter(r => r.topNCMs.length === 0);
  if (noResults.length > 0) {
    console.log(`\n❌ Itens SEM resultados (${noResults.length}):`);
    noResults.forEach(r => {
      console.log(`   • ${r.item.description}`);
    });
  }

  // Casos de sucesso
  const topRank = allResults.filter(r => r.rank === 1);
  if (topRank.length > 0) {
    console.log(`\n✅ Casos de Sucesso (Rank 1 - ${topRank.length}):`);
    topRank.slice(0, 5).forEach(r => {
      console.log(`   • ${r.item.description.substring(0, 60)}...`);
      console.log(`     → NCM ${r.item.expectedNCM}`);
    });
  }

  console.log(`\n${'═'.repeat(80)}\n`);

  return { allResults, accuracy };
}

// Executar
runRealInvoiceTests()
  .then(({ accuracy }) => {
    if (accuracy >= 80) {
      console.log('🎉 SUCCESS! Accuracy atingida: ' + accuracy.toFixed(1) + '%');
      process.exit(0);
    } else {
      console.log('⚠️  Accuracy abaixo do target (80%): ' + accuracy.toFixed(1) + '%');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
