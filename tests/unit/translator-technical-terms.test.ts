/**
 * Unit Tests - Technical Terms Preservation
 *
 * Run: npx ts-node tests/unit/translator-technical-terms.test.ts
 */

import { translateForComex } from '../../src/services/translatorService';

interface TestCase {
  input: string;
  expectedToContain: string[];
  expectedToNotContain: string[];
  description: string;
}

const TEST_CASES: TestCase[] = [
  {
    input: 'Medical Syringes 10ml Luer Lock Sterile Disposable',
    expectedToContain: ['Luer Lock', 'Sterile', 'Disposable'],
    expectedToNotContain: ['fechadura', 'estéril', 'descartável'],
    description: 'Preserve medical technical terms',
  },
  {
    input: 'Wireless Bluetooth Earbuds TWS 5.0 with Charging Case',
    expectedToContain: ['Bluetooth', 'TWS'],
    expectedToNotContain: [],
    description: 'Preserve electronics acronyms',
  },
  {
    input: 'Portable Power Bank 20000mAh Lithium Polymer Battery',
    expectedToContain: ['mAh'],
    expectedToNotContain: [],
    description: 'Preserve units of measurement',
  },
  {
    input: 'Extra Virgin Olive Oil DOP Toscana 500ml Glass Bottle',
    expectedToContain: ['DOP', 'ml'],
    expectedToNotContain: [],
    description: 'Preserve certifications and units',
  },
  {
    input: 'USB-C Fast Charging Cable 2M Nylon Braided',
    expectedToContain: ['USB-C'],
    expectedToNotContain: [],
    description: 'Preserve connector types',
  },
  {
    input: 'Intel Core i7 Laptop 16GB RAM SSD 512GB',
    expectedToContain: ['Intel Core i7', 'RAM', 'SSD', 'GB'],
    expectedToNotContain: [],
    description: 'Preserve computer specs',
  },
  {
    input: 'CNC Milling Machine 3-Axis Desktop Model',
    expectedToContain: ['CNC'],
    expectedToNotContain: [],
    description: 'Preserve industrial acronyms',
  },
];

async function runTests() {
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║         TECHNICAL TERMS PRESERVATION - UNIT TESTS                 ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const test of TEST_CASES) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`📋 Test: ${test.description}`);
    console.log(`   Input: "${test.input}"`);

    try {
      const result = await translateForComex(test.input, 'en');

      console.log(`   Output: "${result.translated}"`);

      if (result.technicalTermsPreserved && result.technicalTermsPreserved.length > 0) {
        console.log(`   🔒 Preserved: ${result.technicalTermsPreserved.join(', ')}`);
      }

      // Check expected terms are preserved
      let testPassed = true;
      const failReasons: string[] = [];

      for (const expectedTerm of test.expectedToContain) {
        if (!result.translated.includes(expectedTerm)) {
          testPassed = false;
          failReasons.push(`Missing: "${expectedTerm}"`);
        }
      }

      // Check unwanted translations are NOT present
      for (const unwantedTerm of test.expectedToNotContain) {
        if (result.translated.toLowerCase().includes(unwantedTerm.toLowerCase())) {
          testPassed = false;
          failReasons.push(`Unwanted translation found: "${unwantedTerm}"`);
        }
      }

      if (testPassed) {
        console.log(`\n   ✅ PASS`);
        passed++;
      } else {
        console.log(`\n   ❌ FAIL: ${failReasons.join(', ')}`);
        failures.push(`${test.description}: ${failReasons.join(', ')}`);
        failed++;
      }

    } catch (error: any) {
      console.log(`\n   ❌ ERROR: ${error.message}`);
      failures.push(`${test.description}: ERROR - ${error.message}`);
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

  if (parseFloat(passRate) === 100) {
    console.log('🎉 SUCCESS! All technical terms preserved correctly!');
    return 0;
  } else {
    console.log('⚠️  Some terms were not preserved correctly');
    return 1;
  }
}

runTests()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
