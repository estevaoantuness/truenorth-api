/**
 * Quick script to check if expected NCMs exist
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkNCMs() {
  const ncms = ['87083020', '15091000', '33049100', '15079010', '85076000'];

  for (const ncm of ncms) {
    const result = await prisma.ncmDatabase.findUnique({
      where: { ncm },
      select: { ncm: true, descricao: true, setor: true },
    });

    if (result) {
      console.log(`✅ ${result.ncm}: ${result.descricao} (${result.setor})`);
    } else {
      console.log(`❌ ${ncm}: NOT FOUND`);
    }
  }

  await prisma.$disconnect();
}

checkNCMs();
