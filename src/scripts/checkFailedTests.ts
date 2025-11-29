/**
 * Check NCMs for failed tests
 */
import { PrismaClient } from '@prisma/client';
import { searchNcmByDescription } from '../services/ncmService';

const prisma = new PrismaClient();

async function check() {
  const tests = [
    { ncm: '87083010', query: 'pastilhas de freio', sector: 'Autopecas' },
    { ncm: '85076000', query: 'bateria de lítio portátil', sector: 'Eletronicos' },
    { ncm: '15079010', query: 'óleo de soja refinado', sector: 'Alimentos' },
    { ncm: '33049100', query: 'creme facial anti-idade', sector: 'Cosmeticos' },
  ];

  for (const test of tests) {
    console.log(`\n=== ${test.query} → ${test.ncm} ===`);

    // Check if NCM exists
    const ncm = await prisma.ncmDatabase.findUnique({
      where: { ncm: test.ncm },
      select: { ncm: true, descricao: true, setor: true },
    });

    if (ncm) {
      console.log(`✅ EXISTS: ${ncm.descricao.substring(0, 80)}`);
      console.log(`   Setor: ${ncm.setor}`);
    } else {
      console.log(`❌ NOT FOUND IN DATABASE`);
    }

    // Try search with sector
    console.log(`\nSearch with sector "${test.sector}":`);
    const results = await searchNcmByDescription(test.query, test.sector, 10);
    results.slice(0, 5).forEach((r, i) => {
      const match = r.ncm === test.ncm ? '✅' : '  ';
      console.log(`${match} ${i + 1}. ${r.ncm} (${r.setor}) score: ${r.score.toFixed(2)}`);
      console.log(`     ${r.descricao.substring(0, 70)}`);
    });

    const found = results.find(r => r.ncm === test.ncm);
    if (found) {
      console.log(`\n   ✅ Found at rank ${results.indexOf(found) + 1} with score ${found.score.toFixed(2)}`);
    } else {
      console.log(`\n   ❌ Not found in top 10`);
    }
  }

  await prisma.$disconnect();
}

check();
