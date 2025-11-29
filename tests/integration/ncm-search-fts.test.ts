/**
 * NCM Full-Text Search Integration Tests
 *
 * Tests the new PostgreSQL FTS implementation
 * Run: npx ts-node tests/integration/ncm-search-fts.test.ts
 */

import { searchNcmByDescription } from '../../src/services/ncmService';

interface TestCase {
  query: string;
  expected: string;
  description: string;
  sector?: string;
}

const TEST_CASES: TestCase[] = [
  // Autopeças
  {
    query: "pastilhas de freio cerâmica",
    expected: "87083010",
    description: "Guarnições de freio",
    sector: "Autopecas",
  },
  {
    query: "pastilhas de freio",
    expected: "87083010",
    description: "Guarnições de freio (sem especificação)",
    sector: "Autopecas",
  },
  {
    query: "disco de freio",
    expected: "87083000",
    description: "Freios e servofreios (genérico)",
    sector: "Autopecas",
  },
  {
    query: "filtro de óleo para motor",
    expected: "84212300",
    description: "Filtros de óleo",
    sector: "Autopecas",
  },

  // Eletrônicos
  {
    query: "fones de ouvido sem fio bluetooth",
    expected: "85183000",
    description: "Fones de ouvido",
    sector: "Eletronicos",
  },
  {
    query: "fones de ouvido",
    expected: "85183000",
    description: "Fones (sem especificação)",
    sector: "Eletronicos",
  },
  {
    query: "telefone celular smartphone",
    expected: "85171300",
    description: "Smartphone",
    sector: "Eletronicos",
  },
  {
    query: "bateria de lítio portátil",
    expected: "85076000",
    description: "Acumuladores de lítio",
    sector: "Eletronicos",
  },

  // Alimentos
  {
    query: "azeite de oliva extravirgem",
    expected: "15092000",
    description: "Azeite extra virgem",
    sector: "Alimentos",
  },
  {
    query: "azeite de oliva",
    expected: "15090000",
    description: "Azeite (genérico)",
    sector: "Alimentos",
  },
  {
    query: "óleo de soja refinado",
    expected: "15079010",
    description: "Óleo de soja",
    sector: "Alimentos",
  },

  // Cosméticos
  {
    query: "perfume eau de toilette",
    expected: "33030010",
    description: "Perfumes e águas de colônia",
    sector: "Cosmeticos",
  },
  {
    query: "creme facial anti-idade",
    expected: "33049910",
    description: "Cremes de beleza e cremes nutritivos",
    sector: "Cosmeticos",
  },
];

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('         NCM FULL-TEXT SEARCH INTEGRATION TESTS');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const test of TEST_CASES) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`📋 Query: "${test.query}"`);
    console.log(`   Expected NCM: ${test.expected} (${test.description})`);
    if (test.sector) {
      console.log(`   Sector filter: ${test.sector}`);
    }

    try {
      const results = await searchNcmByDescription(test.query, test.sector, 5);

      if (results.length > 0) {
        console.log(`\n   📊 Top 5 Results:\n`);
        results.forEach((r, i) => {
          const match = r.ncm === test.expected ? '✅' : '  ';
          console.log(`   ${match} ${i + 1}. NCM ${r.ncm} (score: ${r.score.toFixed(2)})`);
          console.log(`      ${r.descricao.substring(0, 60)}...`);
        });

        const found = results.find(r => r.ncm === test.expected);
        if (found) {
          console.log(`\n   ✅ PASS - Expected NCM found at rank ${results.indexOf(found) + 1}`);
          passed++;
        } else {
          const msg = `   ❌ FAIL - Expected NCM ${test.expected} not in top 5`;
          console.log(msg);
          failures.push(`${test.query} → ${test.expected}`);
          failed++;
        }
      } else {
        const msg = `   ❌ FAIL - No results found`;
        console.log(msg);
        failures.push(`${test.query} → NO RESULTS`);
        failed++;
      }

    } catch (error: any) {
      console.log(`   ❌ ERROR - ${error.message}`);
      failures.push(`${test.query} → ERROR: ${error.message}`);
      failed++;
    }
  }

  // Summary
  console.log(`\n${'═'.repeat(70)}`);
  console.log('                           SUMMARY');
  console.log(`${'═'.repeat(70)}\n`);

  const total = passed + failed;
  const passRate = ((passed / total) * 100).toFixed(1);

  console.log(`📊 Results: ${passed}/${total} tests passed (${passRate}%)`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}\n`);

  if (failures.length > 0) {
    console.log('Failed tests:');
    failures.forEach(f => console.log(`   - ${f}`));
    console.log('');
  }

  // Performance comparison
  console.log('─'.repeat(70));
  console.log('PERFORMANCE NOTES:\n');
  console.log('Full-Text Search should be:');
  console.log('  • 3-7x faster than old ILIKE search');
  console.log('  • More accurate due to semantic ranking');
  console.log('  • Better at handling Portuguese stop words\n');

  // Expected improvement
  console.log('─'.repeat(70));
  console.log('EXPECTED IMPROVEMENT:\n');
  console.log('  Before FTS: ~30% accuracy (word-by-word search)');
  console.log(`  After FTS:  ${passRate}% accuracy (semantic search)`);
  const improvement = parseFloat(passRate) - 30;
  console.log(`  Improvement: +${improvement.toFixed(1)}pp\n`);

  if (parseFloat(passRate) >= 80) {
    console.log('🎉 SUCCESS! Target of 80%+ accuracy achieved!');
    return 0;
  } else if (parseFloat(passRate) >= 60) {
    console.log('⚠️  GOOD PROGRESS but not yet at 80% target');
    console.log('   Consider: Adding more synonyms or adjusting ts_rank weights');
    return 1;
  } else {
    console.log('❌ NEEDS IMPROVEMENT - Below 60% accuracy');
    console.log('   Check: Is FTS index properly created? Are queries in Portuguese?');
    return 1;
  }
}

runTests()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
