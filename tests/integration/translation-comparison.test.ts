/**
 * Translation Comparison Test
 *
 * Compares NCM search results with and without translation
 * To demonstrate the impact of the translator service
 */

import { translateForComex } from '../../src/services/translatorService';
import { searchNcmByDescription } from '../../src/services/ncmService';

async function compareSearch(englishText: string, expectedNcm: string) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`📋 Test: "${englishText}"`);
  console.log(`   Expected NCM: ${expectedNcm}\n`);

  // Search WITHOUT translation (direct English)
  console.log('   🔴 WITHOUT Translation (searching in English):');
  const resultsEN = await searchNcmByDescription(englishText, undefined, 5);
  const foundEN = resultsEN.find(r => r.ncm === expectedNcm);

  if (resultsEN.length > 0) {
    resultsEN.slice(0, 3).forEach((r, i) => {
      const match = r.ncm === expectedNcm ? '✅' : '  ';
      console.log(`      ${match} ${i + 1}. ${r.ncm} - ${r.descricao.substring(0, 40)}...`);
    });
  } else {
    console.log('      ❌ No results');
  }

  // Search WITH translation (English → Portuguese)
  console.log('\n   🟢 WITH Translation (translated to Portuguese):');
  const translation = await translateForComex(englishText, 'en');
  console.log(`      Translated: "${translation.translated}"`);

  const resultsPT = await searchNcmByDescription(translation.translated, undefined, 5);
  const foundPT = resultsPT.find(r => r.ncm === expectedNcm);

  if (resultsPT.length > 0) {
    resultsPT.slice(0, 3).forEach((r, i) => {
      const match = r.ncm === expectedNcm ? '✅' : '  ';
      console.log(`      ${match} ${i + 1}. ${r.ncm} - ${r.descricao.substring(0, 40)}...`);
    });
  } else {
    console.log('      ❌ No results');
  }

  // Compare results
  console.log('\n   📊 Impact:');
  if (foundPT && !foundEN) {
    console.log('      ✅ IMPROVED - NCM found only with translation!');
    return 'improved';
  } else if (foundPT && foundEN) {
    console.log('      ✅ MAINTAINED - NCM found in both (translation didn\'t hurt)');
    return 'maintained';
  } else if (!foundPT && !foundEN) {
    console.log('      ⚠️  NO CHANGE - NCM not found in either case (search algorithm issue)');
    return 'no_change';
  } else {
    console.log('      ❌ DEGRADED - NCM found without translation but not with');
    return 'degraded';
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('           TRANSLATION IMPACT COMPARISON TEST');
  console.log('═══════════════════════════════════════════════════════════════════');

  const testCases = [
    { text: 'Wireless Bluetooth Earbuds', ncm: '85183000' },
    { text: 'Brake Pads Ceramic', ncm: '87083010' },
    { text: 'Extra Virgin Olive Oil', ncm: '15091000' },
    { text: 'Power Bank Lithium Battery', ncm: '85076000' },
    { text: 'LED Display Module', ncm: '85423100' },
  ];

  const results = {
    improved: 0,
    maintained: 0,
    no_change: 0,
    degraded: 0,
  };

  for (const test of testCases) {
    const result = await compareSearch(test.text, test.ncm);
    results[result]++;
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('                           SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log(`✅ IMPROVED:    ${results.improved} cases (translation found NCM when English didn't)`);
  console.log(`✅ MAINTAINED:  ${results.maintained} cases (translation preserved existing match)`);
  console.log(`⚠️  NO CHANGE:   ${results.no_change} cases (neither found NCM - search needs improvement)`);
  console.log(`❌ DEGRADED:    ${results.degraded} cases (translation broke existing match)`);

  const totalTests = testCases.length;
  const positiveImpact = results.improved + results.maintained;
  const impactRate = ((positiveImpact / totalTests) * 100).toFixed(1);

  console.log(`\n📊 Translation Impact: ${positiveImpact}/${totalTests} positive (${impactRate}%)`);

  if (results.degraded > 0) {
    console.log('\n❌ Translation caused regressions. Needs debugging.');
    process.exit(1);
  } else if (results.improved > 0) {
    console.log('\n🎉 Translation is HELPING! Some items now found that weren\'t before.');
    console.log('   Note: Items with "NO CHANGE" need search algorithm improvements (not translation issue).\n');
    process.exit(0);
  } else if (results.no_change === totalTests) {
    console.log('\n⚠️  Translation didn\'t help yet, but also didn\'t hurt.');
    console.log('   This is a SEARCH ALGORITHM problem, not a translation problem.\n');
    process.exit(0);
  } else {
    console.log('\n✅ Translation is working correctly (maintains existing matches).\n');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
