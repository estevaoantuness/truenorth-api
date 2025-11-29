/**
 * Script to run Full-Text Search migration
 *
 * Run: npx ts-node src/scripts/runFullTextMigration.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function runMigration() {
  console.log('🚀 Starting Full-Text Search migration...\n');

  try {
    // Execute SQL statements directly
    console.log('[1/3] Adding tsvector column...');
    try {
      await prisma.$executeRaw`
        ALTER TABLE ncm_database
        ADD COLUMN IF NOT EXISTS descricao_tsvector tsvector
        GENERATED ALWAYS AS (to_tsvector('portuguese', descricao)) STORED
      `;
      console.log('   ✅ Column added\n');
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log('   ⚠️  Column already exists\n');
      } else {
        throw error;
      }
    }

    console.log('[2/3] Creating GIN index...');
    try {
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_ncm_descricao_fts
        ON ncm_database
        USING GIN(descricao_tsvector)
      `;
      console.log('   ✅ Index created\n');
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log('   ⚠️  Index already exists\n');
      } else {
        throw error;
      }
    }

    console.log('[3/3] Analyzing table...');
    await prisma.$executeRaw`ANALYZE ncm_database`;
    console.log('   ✅ Analysis complete\n');

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ Migration completed successfully!\n');

    // Verify the migration
    console.log('🔍 Verifying migration...\n');

    // Check if column exists
    const columnCheck = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
      SELECT column_name, data_type, is_generated
      FROM information_schema.columns
      WHERE table_name = 'ncm_database' AND column_name = 'descricao_tsvector'
    `;

    if (columnCheck.length > 0) {
      console.log('✅ Column descricao_tsvector created:', columnCheck[0]);
    } else {
      console.log('❌ Column descricao_tsvector NOT found');
    }

    // Check if index exists
    const indexCheck = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'ncm_database' AND indexname = 'idx_ncm_descricao_fts'
    `;

    if (indexCheck.length > 0) {
      console.log('✅ Index idx_ncm_descricao_fts created');
    } else {
      console.log('❌ Index idx_ncm_descricao_fts NOT found');
    }

    // Test full-text search
    console.log('\n🧪 Testing full-text search with "pastilhas de freio"...\n');

    const testResults = await prisma.$queryRaw<Array<{
      ncm: string;
      descricao: string;
      relevance: number;
    }>>`
      SELECT ncm, descricao, ts_rank(descricao_tsvector, query) AS relevance
      FROM ncm_database, plainto_tsquery('portuguese', 'pastilhas de freio') query
      WHERE descricao_tsvector @@ query
      ORDER BY relevance DESC
      LIMIT 5
    `;

    if (testResults.length > 0) {
      console.log(`Found ${testResults.length} results:\n`);
      testResults.forEach((r, i) => {
        const isCorrect = r.ncm === '87083010' ? '✅' : '  ';
        console.log(`${isCorrect} ${i + 1}. NCM ${r.ncm} (relevance: ${r.relevance.toFixed(4)})`);
        console.log(`   ${r.descricao.substring(0, 80)}...`);
      });

      const foundCorrect = testResults.some(r => r.ncm === '87083010');
      if (foundCorrect) {
        console.log('\n🎉 SUCCESS! Full-text search is finding the correct NCM!');
      } else {
        console.log('\n⚠️  Correct NCM (87083010) not in top 5 - may need tuning');
      }
    } else {
      console.log('❌ No results found - migration may have failed');
    }

    console.log('\n═══════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
