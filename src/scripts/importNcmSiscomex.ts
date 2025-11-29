/**
 * Script para importar NCMs do arquivo combinado ncm_completo.json
 * para o banco de dados PostgreSQL via Prisma
 *
 * Uso: npx ts-node src/scripts/importNcmSiscomex.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface NcmRecord {
  ncm: string;
  descricao: string;
  capitulo: string;
  aliquota_ii: number;
  aliquota_ipi: number;
  aliquota_pis: number;
  aliquota_cofins: number;
  anuentes: string[];
  requer_lpco: boolean;
  setor: string;
  fonte_ncm: string;
}

async function importNcm() {
  console.log('='.repeat(60));
  console.log('Importando NCMs para PostgreSQL');
  console.log('='.repeat(60));

  // Ler arquivo JSON
  const jsonPath = path.join(__dirname, '../../ncm_completo.json');

  if (!fs.existsSync(jsonPath)) {
    console.error(`Arquivo não encontrado: ${jsonPath}`);
    console.log('Execute primeiro: python3 scripts/parse_tipi_siscomex.py');
    process.exit(1);
  }

  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const ncmData: NcmRecord[] = JSON.parse(rawData);

  console.log(`Total de NCMs no arquivo: ${ncmData.length}`);

  // Limpar tabela existente (opcional - pode ser perigoso em produção)
  const confirmClear = process.argv.includes('--clear');
  if (confirmClear) {
    console.log('\nLimpando tabela existente...');
    await prisma.ncmDatabase.deleteMany({});
  }

  // Importar em lotes para melhor performance
  const BATCH_SIZE = 500;
  let imported = 0;
  let errors = 0;

  console.log(`\nImportando em lotes de ${BATCH_SIZE}...`);

  for (let i = 0; i < ncmData.length; i += BATCH_SIZE) {
    const batch = ncmData.slice(i, i + BATCH_SIZE);

    try {
      await prisma.$transaction(
        batch.map((record) =>
          prisma.ncmDatabase.upsert({
            where: { ncm: record.ncm },
            update: {
              descricao: record.descricao.substring(0, 1000),
              capitulo: record.capitulo,
              aliquotaIi: record.aliquota_ii,
              aliquotaIpi: record.aliquota_ipi,
              aliquotaPis: record.aliquota_pis,
              aliquotaCofins: record.aliquota_cofins,
              anuentes: record.anuentes,
              requerLpco: record.requer_lpco,
              setor: record.setor,
              fonte: record.fonte_ncm,
            },
            create: {
              ncm: record.ncm,
              descricao: record.descricao.substring(0, 1000),
              capitulo: record.capitulo,
              aliquotaIi: record.aliquota_ii,
              aliquotaIpi: record.aliquota_ipi,
              aliquotaPis: record.aliquota_pis,
              aliquotaCofins: record.aliquota_cofins,
              anuentes: record.anuentes,
              requerLpco: record.requer_lpco,
              setor: record.setor,
              fonte: record.fonte_ncm,
            },
          })
        )
      );

      imported += batch.length;
      process.stdout.write(`\rImportados: ${imported}/${ncmData.length} (${Math.round(100 * imported / ncmData.length)}%)`);
    } catch (error: any) {
      errors += batch.length;
      console.error(`\nErro no lote ${i}-${i + BATCH_SIZE}: ${error.message}`);
    }
  }

  console.log('\n');

  // Estatísticas finais
  const count = await prisma.ncmDatabase.count();
  const bySetor = await prisma.ncmDatabase.groupBy({
    by: ['setor'],
    _count: { ncm: true },
    orderBy: { _count: { ncm: 'desc' } },
    take: 10,
  });

  console.log('='.repeat(60));
  console.log('IMPORTAÇÃO CONCLUÍDA');
  console.log('='.repeat(60));
  console.log(`Total de NCMs no banco: ${count}`);
  console.log(`Importados nesta execução: ${imported}`);
  console.log(`Erros: ${errors}`);
  console.log('\nTop 10 setores:');
  bySetor.forEach((s) => {
    console.log(`  ${s.setor || 'N/A'}: ${s._count.ncm}`);
  });

  // Teste de busca
  console.log('\n' + '='.repeat(60));
  console.log('TESTE DE BUSCA');
  console.log('='.repeat(60));

  const testNcms = ['85171231', '30049099', '33049100', '87089990'];
  for (const ncm of testNcms) {
    const result = await prisma.ncmDatabase.findUnique({ where: { ncm } });
    if (result) {
      console.log(`\nNCM ${ncm}:`);
      console.log(`  Descrição: ${result.descricao?.substring(0, 60)}...`);
      console.log(`  Setor: ${result.setor}`);
      console.log(`  II: ${result.aliquotaIi}%, IPI: ${result.aliquotaIpi}%`);
      console.log(`  PIS: ${result.aliquotaPis}%, COFINS: ${result.aliquotaCofins}%`);
      console.log(`  Anuentes: ${result.anuentes?.join(', ') || 'Nenhum'}`);
    } else {
      console.log(`\nNCM ${ncm}: Não encontrado`);
    }
  }
}

importNcm()
  .catch((error) => {
    console.error('Erro fatal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
