-- street_cricket_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Teams Table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_name VARCHAR(255) UNIQUE NOT NULL,
    player1_name VARCHAR(255) NOT NULL,
    player2_name VARCHAR(255) NOT NULL,
    player3_name VARCHAR(255), -- optional substitute
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Fixtures Table
CREATE TABLE fixtures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_a_id UUID REFERENCES teams(id) NOT NULL,
    team_b_id UUID REFERENCES teams(id) NOT NULL,
    total_overs INTEGER NOT NULL,
    match_date DATE,
    match_start_time TIMESTAMP WITH TIME ZONE,
    match_end_time TIMESTAMP WITH TIME ZONE,
    toss_winner_id UUID REFERENCES teams(id),
    toss_decision VARCHAR(10) CHECK (toss_decision IN ('bat', 'bowl')),
    status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'toss', 'live', 'completed', 'super_over')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT different_teams CHECK (team_a_id != team_b_id)
);

-- Match Scores Table
CREATE TABLE match_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fixture_id UUID REFERENCES fixtures(id) NOT NULL,
    team_id UUID REFERENCES teams(id) NOT NULL,
    innings INTEGER NOT NULL CHECK (innings IN (1, 2, 3, 4)), -- 3,4 for super over
    runs INTEGER DEFAULT 0,
    wickets INTEGER DEFAULT 0,
    balls_bowled INTEGER DEFAULT 0, -- Valid, legal balls
    extras INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(fixture_id, innings)
);

-- Ball by Ball Events Table
CREATE TABLE ball_by_ball (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fixture_id UUID REFERENCES fixtures(id) NOT NULL,
    innings INTEGER NOT NULL,
    batting_team_id UUID REFERENCES teams(id) NOT NULL,
    bowling_team_id UUID REFERENCES teams(id) NOT NULL,
    
    over_number INTEGER NOT NULL, -- Logical over number (e.g., 0, 1)
    ball_number INTEGER NOT NULL, -- Logical legal ball number (e.g., 1 to 6)
    
    runs_scored INTEGER DEFAULT 0, -- off the bat
    extras INTEGER DEFAULT 0,
    is_wide BOOLEAN DEFAULT false,
    is_no_ball BOOLEAN DEFAULT false,
    is_wicket BOOLEAN DEFAULT false,
    wicket_type VARCHAR(50), -- bowled, caught, run_out
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger for updated_at in match_scores
CREATE OR REPLACE FUNCTION update_modified_column()   
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;   
END;
$$ language 'plpgsql';

CREATE TRIGGER update_match_scores_modtime
    BEFORE UPDATE ON match_scores
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();
