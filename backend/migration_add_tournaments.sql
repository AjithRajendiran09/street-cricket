-- 1. Create the Tournaments table
CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add tournament_id to Teams
ALTER TABLE teams ADD COLUMN tournament_id UUID REFERENCES tournaments(id);

-- 3. Modify Team Name Uniqueness to be strictly per-tournament instead of global
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_team_name_key;
ALTER TABLE teams ADD CONSTRAINT unique_team_name_per_tournament UNIQUE (tournament_id, team_name);

-- 4. Add tournament_id to Fixtures
ALTER TABLE fixtures ADD COLUMN tournament_id UUID REFERENCES tournaments(id);

-- Optional: Create an initial default tournament if you have existing data
-- INSERT INTO tournaments (name) VALUES ('Season 1');
-- UPDATE teams SET tournament_id = (SELECT id FROM tournaments LIMIT 1) WHERE tournament_id IS NULL;
-- UPDATE fixtures SET tournament_id = (SELECT id FROM tournaments LIMIT 1) WHERE tournament_id IS NULL;
