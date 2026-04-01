-- Add player tracking to ball-by-ball table for individual stats
ALTER TABLE ball_by_ball ADD COLUMN striker_name VARCHAR(255);
ALTER TABLE ball_by_ball ADD COLUMN bowler_name VARCHAR(255);

-- To support Man of the Match (MoM)
ALTER TABLE fixtures ADD COLUMN mom_player_name VARCHAR(255);
