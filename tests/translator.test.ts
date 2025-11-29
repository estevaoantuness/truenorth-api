/**
 * Translation Service Tests
 *
 * Tests language detection and COMEX dictionary translation
 * Run: npx ts-node tests/translator.test.ts
 */

import { detectLanguage, translateForComex } from '../src/services/translatorService';

// Test cases covering all supported languages
const TEST_CASES = {
  portuguese: [
    { text: 'Pastilhas de freio cerâmica para veículos', expected: 'pt' },
    { text: 'Azeite de oliva extravirgem italiano', expected: 'pt' },
    { text: 'Telefone celular com tela OLED', expected: 'pt' },
    { text: 'Bomba hidráulica para uso industrial', expected: 'pt' },
  ],
  english: [
    { text: 'Wireless Bluetooth Earbuds TWS', expected: 'en' },
    { text: 'Brake Pads Ceramic Front Axle', expected: 'en' },
    { text: 'Extra Virgin Olive Oil 1L Glass Bottle', expected: 'en' },
    { text: 'Smartphone with OLED Display and 5G', expected: 'en' },
    { text: 'Industrial Hydraulic Pump 3000PSI', expected: 'en' },
    { text: 'LED Display Module RGB 64x32', expected: 'en' },
  ],
  spanish: [
    { text: 'Aceite de oliva virgen extra para cocinar', expected: 'es' },
    { text: 'Pastillas de freno cerámicas para automóviles', expected: 'es' },
    { text: 'Teléfono móvil con pantalla táctil', expected: 'es' },
  ],
  chinese: [
    { text: '无线蓝牙耳机 TWS', expected: 'zh' },
    { text: '智能手机 OLED 显示屏', expected: 'zh' },
    { text: '工业液压泵 3000PSI', expected: 'zh' },
  ],
};

// Translation test cases (EN → PT)
const TRANSLATION_TESTS = [
  {
    input: 'Wireless Bluetooth Earbuds',
    expectedTerms: ['fones de ouvido', 'sem fio'],
    description: 'Should translate wireless earbuds correctly',
  },
  {
    input: 'Brake Pads Ceramic',
    expectedTerms: ['pastilhas de freio'],
    description: 'Should translate brake pads correctly',
  },
  {
    input: 'Extra Virgin Olive Oil',
    expectedTerms: ['azeite', 'extravirgem'],
    description: 'Should translate olive oil correctly',
  },
  {
    input: 'Power Bank Lithium Battery',
    expectedTerms: ['bateria', 'lítio'],
    description: 'Should translate power bank correctly',
  },
  {
    input: 'LED Display Module',
    expectedTerms: ['display led', 'led'],
    description: 'Should translate LED display correctly',
  },
  {
    input: 'Stainless Steel Pipe',
    expectedTerms: ['aço inoxidável', 'tubo'],
    description: 'Should translate steel pipe correctly',
  },
  {
    input: 'USB Cable Type-C',
    expectedTerms: ['cabo usb'],
    description: 'Should translate USB cable correctly',
  },
];

// ============================================================
// TEST RUNNER
// ============================================================

interface TestResult {
  category: string;
  passed: number;
  failed: number;
  total: number;
  details: string[];
}

async function runLanguageDetectionTests(): Promise<TestResult> {
  console.log('\n📋 Running Language Detection Tests...\n');

  const result: TestResult = {
    category: 'Language Detection',
    passed: 0,
    failed: 0,
    total: 0,
    details: [],
  };

  for (const [lang, cases] of Object.entries(TEST_CASES)) {
    console.log(`\n🌍 Testing ${lang.toUpperCase()} detection:`);

    for (const testCase of cases) {
      result.total++;
      const detected = detectLanguage(testCase.text);
      const passed = detected === testCase.expected;

      if (passed) {
        result.passed++;
        console.log(`  ✅ "${testCase.text.substring(0, 40)}..." → ${detected}`);
      } else {
        result.failed++;
        const msg = `  ❌ "${testCase.text.substring(0, 40)}..." → Expected: ${testCase.expected}, Got: ${detected}`;
        console.log(msg);
        result.details.push(msg);
      }
    }
  }

  return result;
}

async function runTranslationTests(): Promise<TestResult> {
  console.log('\n\n📋 Running Translation Tests (EN → PT)...\n');

  const result: TestResult = {
    category: 'Translation',
    passed: 0,
    failed: 0,
    total: 0,
    details: [],
  };

  for (const test of TRANSLATION_TESTS) {
    result.total++;
    console.log(`\n🔄 ${test.description}`);
    console.log(`   Input: "${test.input}"`);

    try {
      const translation = await translateForComex(test.input, 'en');
      console.log(`   Output: "${translation.translated}"`);
      console.log(`   Confidence: ${translation.confidence}`);
      console.log(`   Source: ${translation.fromCache ? 'Cache' : 'Dictionary/Gemini'}`);

      // Check if expected terms are in the translation
      const translatedLower = translation.translated.toLowerCase();
      const matchedTerms = test.expectedTerms.filter(term =>
        translatedLower.includes(term.toLowerCase())
      );

      const passed = matchedTerms.length > 0;

      if (passed) {
        result.passed++;
        console.log(`   ✅ PASS - Matched terms: ${matchedTerms.join(', ')}`);
      } else {
        result.failed++;
        const msg = `   ❌ FAIL - Expected terms: ${test.expectedTerms.join(', ')}, but none found in translation`;
        console.log(msg);
        result.details.push(msg);
      }
    } catch (error: any) {
      result.failed++;
      const msg = `   ❌ ERROR - ${error.message}`;
      console.log(msg);
      result.details.push(msg);
    }
  }

  return result;
}

async function runSkipTranslationTest(): Promise<TestResult> {
  console.log('\n\n📋 Running Skip Translation Test (PT → PT)...\n');

  const result: TestResult = {
    category: 'Skip Translation',
    passed: 0,
    failed: 0,
    total: 1,
    details: [],
  };

  const portugueseText = 'Pastilhas de freio cerâmica para automóveis';
  console.log(`   Input: "${portugueseText}"`);

  try {
    const translation = await translateForComex(portugueseText);
    console.log(`   Output: "${translation.translated}"`);
    console.log(`   Detected Language: ${translation.sourceLanguage}`);
    console.log(`   Translation Skipped: ${translation.translated === portugueseText}`);

    const passed = translation.sourceLanguage === 'pt' && translation.translated === portugueseText;

    if (passed) {
      result.passed++;
      console.log(`   ✅ PASS - Portuguese text not translated (as expected)`);
    } else {
      result.failed++;
      const msg = `   ❌ FAIL - Portuguese text should not be translated`;
      console.log(msg);
      result.details.push(msg);
    }
  } catch (error: any) {
    result.failed++;
    const msg = `   ❌ ERROR - ${error.message}`;
    console.log(msg);
    result.details.push(msg);
  }

  return result;
}

async function runPerformanceTest(): Promise<void> {
  console.log('\n\n📊 Running Performance Test...\n');

  const testItems = [
    'Wireless Bluetooth Earbuds',
    'Brake Pads Ceramic',
    'Extra Virgin Olive Oil',
    'Power Bank Lithium Battery',
    'LED Display Module',
  ];

  console.log(`   Testing translation speed for ${testItems.length} items...`);

  const startTime = Date.now();

  for (const item of testItems) {
    await translateForComex(item, 'en');
  }

  const endTime = Date.now();
  const totalTime = endTime - startTime;
  const avgTime = totalTime / testItems.length;

  console.log(`   Total time: ${totalTime}ms`);
  console.log(`   Average per item: ${avgTime.toFixed(2)}ms`);
  console.log(`   Throughput: ${(1000 / avgTime).toFixed(2)} items/second`);

  if (avgTime < 100) {
    console.log(`   ✅ EXCELLENT - Dictionary lookups are fast!`);
  } else if (avgTime < 500) {
    console.log(`   ⚠️  OK - Some items may be using Gemini fallback`);
  } else {
    console.log(`   ❌ SLOW - Most items using Gemini (check API key)`);
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('       TRANSLATOR SERVICE TEST SUITE');
  console.log('═══════════════════════════════════════════════════════');

  const results: TestResult[] = [];

  try {
    // Run all test suites
    results.push(await runLanguageDetectionTests());
    results.push(await runTranslationTests());
    results.push(await runSkipTranslationTest());
    await runPerformanceTest();

    // Print summary
    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('                    SUMMARY');
    console.log('═══════════════════════════════════════════════════════\n');

    let totalPassed = 0;
    let totalFailed = 0;
    let totalTests = 0;

    for (const result of results) {
      totalPassed += result.passed;
      totalFailed += result.failed;
      totalTests += result.total;

      const passRate = ((result.passed / result.total) * 100).toFixed(1);
      const icon = result.failed === 0 ? '✅' : '⚠️';

      console.log(`${icon} ${result.category}: ${result.passed}/${result.total} passed (${passRate}%)`);

      if (result.details.length > 0) {
        console.log(`   Failed tests:`);
        for (const detail of result.details) {
          console.log(`   ${detail}`);
        }
      }
    }

    const overallPassRate = ((totalPassed / totalTests) * 100).toFixed(1);

    console.log('\n───────────────────────────────────────────────────────');
    console.log(`📊 OVERALL: ${totalPassed}/${totalTests} tests passed (${overallPassRate}%)`);
    console.log('═══════════════════════════════════════════════════════\n');

    if (totalFailed === 0) {
      console.log('🎉 All tests passed! Translation service is ready.');
      process.exit(0);
    } else {
      console.log(`⚠️  ${totalFailed} test(s) failed. Review the details above.`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Fatal error running tests:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
main();
