/**
 * Translation Integration Test
 *
 * Tests the full flow: Extract → Translate → Classify
 * Simulates processing an English invoice
 */

import { detectLanguage, translateForComex } from '../../src/services/translatorService';
import { searchNcmByDescription } from '../../src/services/ncmService';

async function testTranslationIntegration() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('     TRANSLATION INTEGRATION TEST');
  console.log('═══════════════════════════════════════════════════════\n');

  // Simulate extracted items from an English invoice
  const englishItems = [
    {
      description: 'Wireless Bluetooth Earbuds TWS',
      expected_ncm: '85183000',
    },
    {
      description: 'Brake Pads Ceramic Front',
      expected_ncm: '87083010',
    },
    {
      description: 'Extra Virgin Olive Oil 1L',
      expected_ncm: '15091000',
    },
    {
      description: 'Power Bank 20000mAh Lithium Battery',
      expected_ncm: '85076000',
    },
    {
      description: 'LED Display Module RGB 64x32',
      expected_ncm: '85423100',
    },
  ];

  console.log('📦 Processing English Invoice Items:\n');

  let successCount = 0;
  let failCount = 0;

  for (const item of englishItems) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📋 Original (EN): "${item.description}"`);

    // Step 1: Detect language
    const language = detectLanguage(item.description);
    console.log(`   🌍 Detected Language: ${language.toUpperCase()}`);

    // Step 2: Translate if not Portuguese
    let translatedDescription = item.description;
    if (language !== 'pt') {
      const translation = await translateForComex(item.description, language);
      translatedDescription = translation.translated;
      console.log(`   🔄 Translated (PT): "${translatedDescription}"`);
      console.log(`   💯 Confidence: ${(translation.confidence * 100).toFixed(0)}%`);
    }

    // Step 3: Search NCM with translated description
    console.log(`   🔍 Searching NCM database...`);
    const results = await searchNcmByDescription(translatedDescription, undefined, 5);

    if (results.length > 0) {
      console.log(`   📊 Top ${results.length} NCM matches:`);
      results.forEach((r, i) => {
        const match = r.ncm === item.expected_ncm ? '✅' : '  ';
        console.log(`      ${match} ${i + 1}. ${r.ncm} - ${r.descricao.substring(0, 50)}...`);
      });

      // Check if expected NCM is in results
      const found = results.find(r => r.ncm === item.expected_ncm);
      if (found) {
        console.log(`   ✅ SUCCESS - Expected NCM ${item.expected_ncm} found!`);
        successCount++;
      } else {
        console.log(`   ❌ FAIL - Expected NCM ${item.expected_ncm} not in top 5`);
        failCount++;
      }
    } else {
      console.log(`   ❌ FAIL - No NCM matches found`);
      failCount++;
    }
  }

  // Summary
  console.log(`\n${'═'.repeat(60)}`);
  console.log('                    SUMMARY');
  console.log('═'.repeat(60));

  const total = successCount + failCount;
  const successRate = ((successCount / total) * 100).toFixed(1);

  console.log(`\n📊 Results: ${successCount}/${total} items correctly classified (${successRate}%)`);

  if (successCount === total) {
    console.log('🎉 ALL TESTS PASSED! Translation is working perfectly!\n');
    return 0;
  } else if (successCount > 0) {
    console.log(`⚠️  ${failCount} items failed. Translation is helping but needs improvement.\n`);
    return 1;
  } else {
    console.log('❌ ALL TESTS FAILED. Translation may not be integrated correctly.\n');
    return 1;
  }
}

// Run test
testTranslationIntegration()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
