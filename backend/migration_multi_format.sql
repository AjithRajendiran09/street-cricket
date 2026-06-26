-- ============================================================
-- Migration: Multi-Format Tournament Support
-- Adds: League, Knockout, Test Match formats
-- Run this in your Supabase SQL Editor after all previous migrations.
-- ============================================================

-- 1. Add format column to tournaments
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS format VARCHAR(20) DEFAULT 'league'
    CHECK (format IN ('league', 'knockout', 'test'));

-- 2. Migrate teams to dynamic players (JSONB array)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS players JSONB;

-- Migrate existing player columns into the JSON array
UPDATE teams
SET players = (
    SELECT jsonb_agg(name)
    FROM (
        SELECT player1_name AS name WHERE player1_name IS NOT NULL
        UNION ALL
        SELECT player2_name WHERE player2_name IS NOT NULL
        UNION ALL
        SELECT player3_name WHERE player3_name IS NOT NULL AND player3_name != ''
    ) sub
)
WHERE players IS NULL;

-- Fallback: ensure no NULLs remain
UPDATE teams SET players = '[]'::jsonb WHERE players IS NULL;

-- Keep old columns for now (drop after confirming migration works)
-- ALTER TABLE teams DROP COLUMN IF EXISTS player1_name;
-- ALTER TABLE teams DROP COLUMN IF EXISTS player2_name;
-- ALTER TABLE teams DROP COLUMN IF EXISTS player3_name;

-- 3. Add knockout & test match columns to fixtures
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS innings_count INTEGER DEFAULT 2;
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS max_overs_per_innings INTEGER;
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS follow_on_margin INTEGER DEFAULT 50;
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS is_follow_on_enforced BOOLEAN DEFAULT false;
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS innings_order JSONB;
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS bracket_round VARCHAR(50);
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS bracket_position INTEGER;
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS next_fixture_id UUID REFERENCES fixtures(id);

-- Update status check to include 'declared' as a valid end-of-innings reason
-- (The actual status values remain: upcoming, toss, live, completed, super_over)

-- 4. Add declaration flag to match_scores
ALTER TABLE match_scores ADD COLUMN IF NOT EXISTS is_declared BOOLEAN DEFAULT false;

-- 5. Relax the innings CHECK constraint to explicitly allow 1-4
-- First drop the old constraint, then add the new one
ALTER TABLE match_scores DROP CONSTRAINT IF EXISTS match_scores_innings_check;
ALTER TABLE match_scores ADD CONSTRAINT match_scores_innings_check CHECK (innings IN (1, 2, 3, 4));

-- Also relax the UNIQUE constraint to support multi-innings with follow-on sequence
ALTER TABLE match_scores DROP CONSTRAINT IF EXISTS match_scores_fixture_id_innings_key;
ALTER TABLE match_scores ADD CONSTRAINT match_scores_fixture_id_innings_key UNIQUE (fixture_id, innings);

-- 6. Set defaults for existing fixtures
UPDATE fixtures SET innings_count = 2 WHERE innings_count IS NULL;
UPDATE fixtures SET is_follow_on_enforced = false WHERE is_follow_on_enforced IS NULL;
