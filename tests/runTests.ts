/**
 * Testes Manuais com Invoices Reais
 *
 * Executa: npx ts-node tests/runTests.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Importar funções do ncmService
async function getNcmInfo(ncm: string) {
  const normalizedNcm = ncm.replace(/\D/g, '').padEnd(8, '0').slice(0, 8);
  return prisma.ncmDatabase.findUnique({ where: { ncm: normalizedNcm } });
}

async function searchNcmByDescription(query: string, sector?: string, limit: number = 20) {
  const queryLower = query.toLowerCase();
  const words = queryLower.split(/\s+/).filter((w) => w.length >= 3);

  const results = await prisma.ncmDatabase.findMany({
    where: {
      AND: [
        { OR: words.map(word => ({ descricao: { contains: word, mode: 'insensitive' as const } })) },
        sector ? { setor: sector } : {},
      ],
    },
    take: limit,
    select: { ncm: true, descricao: true, setor: true },
  });

  return results;
}

// ============================================================
// INVOICES REAIS PARA TESTE
// ============================================================

const REAL_INVOICES = {
  electronics_china: {
    name: 'Eletrônicos - China',
    items: [
      { description: 'Smartphone Samsung Galaxy S24 Ultra 256GB', expected_ncm: '85171300', expected_sector: 'Eletronicos' },
      { description: 'Wireless Bluetooth Earbuds TWS', expected_ncm: '85183000', expected_sector: 'Eletronicos' },
      { description: 'USB-C Charging Cable 1m', expected_ncm: '85444200', expected_sector: 'Eletronicos' },
      { description: 'Power Bank 20000mAh Lithium Battery', expected_ncm: '85076000', expected_sector: 'Eletronicos' },
    ],
  },
  cosmetics_france: {
    name: 'Cosméticos - França',
    items: [
      { description: 'Perfume Eau de Toilette 100ml', expected_ncm: '33030010', expected_sector: 'Cosmeticos' },
      { description: 'Anti-aging Face Cream 50ml', expected_ncm: '33049100', expected_sector: 'Cosmeticos' },
      { description: 'Shampoo Professional Hair Care 500ml', expected_ncm: '33051000', expected_sector: 'Cosmeticos' },
      { description: 'Lipstick Matte Collection', expected_ncm: '33041000', expected_sector: 'Cosmeticos' },
    ],
  },
  autoparts_germany: {
    name: 'Autopeças - Alemanha',
    items: [
      { description: 'Brake Pads Ceramic Front', expected_ncm: '87083010', expected_sector: 'Autopecas' },
      { description: 'Oil Filter for Diesel Engine', expected_ncm: '84212300', expected_sector: 'Autopecas' },
      { description: 'Spark Plugs Iridium Set', expected_ncm: '85111000', expected_sector: 'Autopecas' },
      { description: 'Car Battery 12V 60Ah', expected_ncm: '85071010', expected_sector: 'Autopecas' },
    ],
  },
  pharma_india: {
    name: 'Farmacêuticos - Índia',
    items: [
      { description: 'Paracetamol 500mg Tablets x1000', expected_ncm: '30049099', expected_sector: 'Farmaceuticos' },
      { description: 'Omeprazole 20mg Capsules', expected_ncm: '30049099', expected_sector: 'Farmaceuticos' },
      { description: 'Amoxicillin 500mg Antibiotic', expected_ncm: '30041000', expected_sector: 'Farmaceuticos' },
    ],
  },
  food_italy: {
    name: 'Alimentos - Itália',
    items: [
      { description: 'Extra Virgin Olive Oil 1L', expected_ncm: '15091000', expected_sector: 'Alimentos' },
      { description: 'Pasta Spaghetti 500g', expected_ncm: '19021100', expected_sector: 'Alimentos' },
      { description: 'Parmesan Cheese Aged 24 months', expected_ncm: '04069010', expected_sector: 'Alimentos' },
    ],
  },
  machines_japan: {
    name: 'Máquinas - Japão',
    items: [
      { description: 'CNC Milling Machine 5-Axis', expected_ncm: '84571000', expected_sector: 'Maquinas' },
      { description: 'Industrial Robot Arm 6-DOF', expected_ncm: '84795000', expected_sector: 'Maquinas' },
      { description: 'PLC Controller Module', expected_ncm: '85371020', expected_sector: 'Maquinas' },
    ],
  },
};

// ============================================================
// FUNÇÕES DE TESTE
// ============================================================

interface TestResult {
  test: string;
  passed: boolean;
  details: string;
  duration?: number;
}

const results: TestResult[] = [];

function logTest(test: string, passed: boolean, details: string, duration?: number) {
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${test}`);
  if (!passed || details) console.log(`   ${details}`);
  if (duration) console.log(`   ⏱️ ${duration}ms`);
  results.push({ test, passed, details, duration });
}

// ============================================================
// TESTES
// ============================================================

async function testNcmLookup() {
  console.log('\n' + '='.repeat(60));
  console.log('TESTE 1: Busca por NCM Exato');
  console.log('='.repeat(60));

  const testCases = [
    { ncm: '85171300', expectedSetor: 'Eletronicos', description: 'Smartphone' },
    { ncm: '30049099', expectedSetor: 'Farmaceuticos', description: 'Medicamento' },
    { ncm: '33030010', expectedSetor: 'Cosmeticos', description: 'Perfume' },
    { ncm: '87083010', expectedSetor: 'Autopecas', description: 'Freio' },
    { ncm: '15091000', expectedSetor: 'Alimentos', description: 'Azeite' },
  ];

  for (const tc of testCases) {
    const start = Date.now();
    const result = await getNcmInfo(tc.ncm);
    const duration = Date.now() - start;

    const passed = result !== null && result.setor === tc.expectedSetor;
    logTest(
      `NCM ${tc.ncm} (${tc.description})`,
      passed,
      result ? `Setor: ${result.setor}, Desc: ${result.descricao?.substring(0, 50)}...` : 'Não encontrado',
      duration
    );
  }
}

async function testNcmSearch() {
  console.log('\n' + '='.repeat(60));
  console.log('TESTE 2: Busca por Descrição');
  console.log('='.repeat(60));

  const searchTerms = [
    { term: 'smartphone', expectedNcm: '85171300' },
    { term: 'perfume', expectedNcm: '33030010' },
    { term: 'medicamento', expectedNcm: '30049099' },
    { term: 'azeite oliva', expectedNcm: '15091000' },
    { term: 'freio pastilha', expectedNcm: '87083010' },
    { term: 'robô industrial', expectedNcm: '84795000' },
  ];

  for (const tc of searchTerms) {
    const start = Date.now();
    const results = await searchNcmByDescription(tc.term);
    const duration = Date.now() - start;

    const found = results.slice(0, 10).some(r => r.ncm === tc.expectedNcm);
    const topResults = results.slice(0, 3).map(r => r.ncm).join(', ');

    logTest(
      `Busca "${tc.term}"`,
      results.length > 0,
      found ? `NCM ${tc.expectedNcm} encontrado! Top 3: ${topResults}` : `NCM esperado não nos top 10. Top 3: ${topResults}`,
      duration
    );
  }
}

async function testInvoiceClassification() {
  console.log('\n' + '='.repeat(60));
  console.log('TESTE 3: Classificação de Invoices Reais');
  console.log('='.repeat(60));

  for (const [key, invoice] of Object.entries(REAL_INVOICES)) {
    console.log(`\n📦 ${invoice.name}`);
    console.log('-'.repeat(40));

    let successCount = 0;
    let totalItems = invoice.items.length;

    for (const item of invoice.items) {
      const start = Date.now();
      const results = await searchNcmByDescription(item.description, item.expected_sector, 10);
      const duration = Date.now() - start;

      const foundExact = results.some(r => r.ncm === item.expected_ncm);
      const foundSector = results.some(r => r.setor === item.expected_sector);

      if (foundExact) {
        successCount++;
        console.log(`  ✅ "${item.description.substring(0, 35)}..." → NCM ${item.expected_ncm} ✓`);
      } else if (foundSector) {
        console.log(`  🟡 "${item.description.substring(0, 35)}..." → Setor OK, NCM diferente`);
        console.log(`     Esperado: ${item.expected_ncm}, Obtidos: ${results.slice(0, 3).map(r => r.ncm).join(', ')}`);
      } else {
        console.log(`  ❌ "${item.description.substring(0, 35)}..." → NCM não encontrado`);
        console.log(`     Esperado: ${item.expected_ncm}, Obtidos: ${results.slice(0, 3).map(r => `${r.ncm} (${r.setor})`).join(', ')}`);
      }
    }

    const accuracy = (successCount / totalItems * 100).toFixed(0);
    logTest(
      `Invoice ${key}`,
      successCount >= totalItems * 0.5, // Pelo menos 50% de acerto
      `${successCount}/${totalItems} itens classificados corretamente (${accuracy}%)`
    );
  }
}

async function testAliquotas() {
  console.log('\n' + '='.repeat(60));
  console.log('TESTE 4: Alíquotas e Impostos');
  console.log('='.repeat(60));

  const testCases = [
    { ncm: '85171300', name: 'Smartphone', minII: 0, maxII: 20, minIPI: 0, maxIPI: 15 },
    { ncm: '33030010', name: 'Perfume', minII: 10, maxII: 25, minIPI: 5, maxIPI: 50 },
    { ncm: '30049099', name: 'Medicamento', minII: 0, maxII: 15, minIPI: 0, maxIPI: 5 },
    { ncm: '22041010', name: 'Vinho', minII: 10, maxII: 30, minIPI: 10, maxIPI: 60 },
  ];

  for (const tc of testCases) {
    const result = await getNcmInfo(tc.ncm);
    if (!result) {
      logTest(`Alíquotas ${tc.name}`, false, 'NCM não encontrado');
      continue;
    }

    const ii = Number(result.aliquotaIi) || 0;
    const ipi = Number(result.aliquotaIpi) || 0;
    const pis = Number(result.aliquotaPis) || 0;
    const cofins = Number(result.aliquotaCofins) || 0;

    const iiOk = ii >= tc.minII && ii <= tc.maxII;
    const ipiOk = ipi >= tc.minIPI && ipi <= tc.maxIPI;
    const pisOk = pis > 0;
    const cofinsOk = cofins > 0;

    logTest(
      `Alíquotas ${tc.name} (${tc.ncm})`,
      iiOk && pisOk && cofinsOk,
      `II: ${ii}% (${iiOk ? 'OK' : 'FORA'}), IPI: ${ipi}% (${ipiOk ? 'OK' : 'FORA'}), PIS: ${pis}%, COFINS: ${cofins}%`
    );
  }
}

async function testAnuentes() {
  console.log('\n' + '='.repeat(60));
  console.log('TESTE 5: Detecção de Anuentes');
  console.log('='.repeat(60));

  const testCases = [
    { ncm: '30049099', name: 'Medicamento', expectedAnuentes: ['ANVISA'] },
    { ncm: '33030010', name: 'Perfume', expectedAnuentes: ['ANVISA'] },
    { ncm: '15091000', name: 'Azeite', expectedAnuentes: ['ANVISA', 'MAPA'] },
    { ncm: '85171300', name: 'Smartphone', expectedAnuentes: ['ANATEL'] },
  ];

  for (const tc of testCases) {
    const result = await getNcmInfo(tc.ncm);
    if (!result) {
      logTest(`Anuentes ${tc.name}`, false, 'NCM não encontrado');
      continue;
    }

    const anuentes = result.anuentes || [];
    const hasExpected = tc.expectedAnuentes.some(a => anuentes.includes(a));

    logTest(
      `Anuentes ${tc.name} (${tc.ncm})`,
      hasExpected || (tc.expectedAnuentes.length === 0 && anuentes.length === 0),
      `Esperado: ${tc.expectedAnuentes.join(', ')}, Obtido: ${anuentes.join(', ') || 'Nenhum'}`
    );
  }
}

async function testPerformance() {
  console.log('\n' + '='.repeat(60));
  console.log('TESTE 6: Performance');
  console.log('='.repeat(60));

  // Teste de busca simples
  const iterations = 10;
  let totalTime = 0;

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await getNcmInfo('85171300');
    totalTime += Date.now() - start;
  }

  const avgTime = totalTime / iterations;
  logTest(
    `Busca NCM (média de ${iterations} iterações)`,
    avgTime < 50,
    `Tempo médio: ${avgTime.toFixed(2)}ms`
  );

  // Teste de busca por descrição
  totalTime = 0;
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await searchNcmByDescription('smartphone celular');
    totalTime += Date.now() - start;
  }

  const avgSearchTime = totalTime / iterations;
  logTest(
    `Busca Descrição (média de ${iterations} iterações)`,
    avgSearchTime < 200,
    `Tempo médio: ${avgSearchTime.toFixed(2)}ms`
  );
}

async function testDatabaseStats() {
  console.log('\n' + '='.repeat(60));
  console.log('TESTE 7: Estatísticas do Banco');
  console.log('='.repeat(60));

  const total = await prisma.ncmDatabase.count();
  const withAnuentes = await prisma.ncmDatabase.count({
    where: { NOT: { anuentes: { isEmpty: true } } },
  });

  const bySector = await prisma.ncmDatabase.groupBy({
    by: ['setor'],
    _count: { ncm: true },
    orderBy: { _count: { ncm: 'desc' } },
    take: 10,
  });

  logTest(
    'Total de NCMs no banco',
    total >= 15000,
    `${total} NCMs (mínimo esperado: 15.000)`
  );

  logTest(
    'NCMs com anuentes',
    withAnuentes > 5000,
    `${withAnuentes} NCMs com anuentes (${(withAnuentes/total*100).toFixed(1)}%)`
  );

  console.log('\nTop 10 setores:');
  bySector.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.setor || 'N/A'}: ${s._count.ncm}`);
  });
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('='.repeat(60));
  console.log('🧪 TESTES DE INTEGRAÇÃO - TRUENORTH API');
  console.log('='.repeat(60));
  console.log(`Data: ${new Date().toLocaleString('pt-BR')}`);

  try {
    await testDatabaseStats();
    await testNcmLookup();
    await testNcmSearch();
    await testInvoiceClassification();
    await testAliquotas();
    await testAnuentes();
    await testPerformance();

    // Resumo
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DOS TESTES');
    console.log('='.repeat(60));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;

    console.log(`\n✅ Passou: ${passed}/${total}`);
    console.log(`❌ Falhou: ${failed}/${total}`);
    console.log(`📈 Taxa de sucesso: ${(passed/total*100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n⚠️ Testes que falharam:');
      results.filter(r => !r.passed).forEach(r => {
        console.log(`  - ${r.test}: ${r.details}`);
      });
    }

  } catch (error) {
    console.error('Erro ao executar testes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
