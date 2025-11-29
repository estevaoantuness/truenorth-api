/**
 * Find similar NCMs for failed test cases
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findSimilar() {
  console.log('\n=== Disco de freio (expected: 87083020) ===');
  const discos = await prisma.ncmDatabase.findMany({
    where: {
      OR: [
        { descricao: { contains: 'disco', mode: 'insensitive' } },
        { descricao: { contains: 'freio', mode: 'insensitive' } },
      ],
      ncm: { startsWith: '8708' },
    },
    select: { ncm: true, descricao: true },
    take: 10,
  });
  discos.forEach(d => console.log(`  ${d.ncm}: ${d.descricao.substring(0, 80)}`));

  console.log('\n=== Azeite de oliva (expected: 15091000) ===');
  const azeites = await prisma.ncmDatabase.findMany({
    where: {
      descricao: { contains: 'azeite', mode: 'insensitive' },
    },
    select: { ncm: true, descricao: true },
    orderBy: { ncm: 'asc' },
  });
  azeites.forEach(a => console.log(`  ${a.ncm}: ${a.descricao.substring(0, 80)}`));

  await prisma.$disconnect();
}

findSimilar();
