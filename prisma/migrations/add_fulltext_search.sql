-- Migration: Add PostgreSQL Full-Text Search to NCM Database
-- Created: 2024-11-29
-- Purpose: Improve NCM search accuracy from 30% to 80%+ using native PostgreSQL FTS

-- Step 1: Add tsvector column (auto-computed from descricao)
-- This stores the full-text search tokens for each NCM description
ALTER TABLE ncm_database
ADD COLUMN IF NOT EXISTS descricao_tsvector tsvector
GENERATED ALWAYS AS (to_tsvector('portuguese', descricao)) STORED;

-- Step 2: Create GIN index on tsvector column
-- GIN (Generalized Inverted Index) is optimized for full-text search
-- This makes searches 10-100x faster than ILIKE
CREATE INDEX IF NOT EXISTS idx_ncm_descricao_fts
ON ncm_database
USING GIN(descricao_tsvector);

-- Step 3: Update table statistics for query planner
-- Helps PostgreSQL choose optimal execution plans
ANALYZE ncm_database;

-- Verification queries (optional - for testing)
-- Uncomment to test after running migration:

-- 1. Check if column was created
-- SELECT column_name, data_type, is_generated
-- FROM information_schema.columns
-- WHERE table_name = 'ncm_database' AND column_name = 'descricao_tsvector';

-- 2. Check if index was created
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'ncm_database' AND indexname = 'idx_ncm_descricao_fts';

-- 3. Test full-text search (should find brake pads, NOT mint candies)
-- SELECT ncm, descricao, ts_rank(descricao_tsvector, query) AS relevance
-- FROM ncm_database, plainto_tsquery('portuguese', 'pastilhas de freio') query
-- WHERE descricao_tsvector @@ query
-- ORDER BY relevance DESC
-- LIMIT 5;
