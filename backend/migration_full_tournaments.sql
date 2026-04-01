CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    ground VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Safely add a default tournament for existing data
INSERT INTO tournaments (name, ground) 
VALUES ('Inaugural Season', 'Main Ground') 
ON CONFLICT DO NOTHING;

-- 1. Modify teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES tournaments(id);
UPDATE teams SET tournament_id = (SELECT id FROM tournaments LIMIT 1) WHERE tournament_id IS NULL;
ALTER TABLE teams ALTER COLUMN tournament_id SET NOT NULL;

ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_team_name_key;
ALTER TABLE teams DROP CONSTRAINT IF EXISTS unique_team_name_per_tournament;
ALTER TABLE teams ADD CONSTRAINT unique_team_name_per_tournament UNIQUE (tournament_id, team_name);

-- 2. Modify fixtures table
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES tournaments(id);
UPDATE fixtures SET tournament_id = (SELECT id FROM tournaments LIMIT 1) WHERE tournament_id IS NULL;
ALTER TABLE fixtures ALTER COLUMN tournament_id SET NOT NULL;

-- 3. Add match_type to distinguish League, Semi-Final, Final
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS match_type VARCHAR(50) DEFAULT 'league';
