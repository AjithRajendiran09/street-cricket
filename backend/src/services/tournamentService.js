const supabase = require('../db/supabase');

class TournamentService {
    static async generateLeagueFixtures(defaultOvers = 2, tournament_id) {
        if (!tournament_id) throw new Error("Tournament ID is required to generate fixtures");

        const { data: fixtures } = await supabase.from('fixtures').select('id').eq('tournament_id', tournament_id);
        if (fixtures && fixtures.length > 0) throw new Error("Fixtures already generated for this tournament");

        const { data: teams, error } = await supabase.from('teams').select('id').eq('tournament_id', tournament_id);
        if (error) throw new Error("Error fetching teams");

        const N = teams.length;
        if (N < 2) throw new Error("Need at least 2 teams to generate fixtures");

        const matches = [];
        const teamIds = teams.map(t => t.id);
        
        for (let i = 0; i < N; i++) {
            for (let j = i + 1; j < N; j++) {
                matches.push({ team_a: teamIds[i], team_b: teamIds[j] });
            }
        }

        matches.sort(() => Math.random() - 0.5);

        const fixturesToInsert = matches.map(m => ({
            team_a_id: m.team_a,
            team_b_id: m.team_b,
            total_overs: defaultOvers,
            status: 'upcoming',
            tournament_id: tournament_id,
            match_type: 'League'
        }));

        const { data: inserted, error: insertErr } = await supabase
            .from('fixtures')
            .insert(fixturesToInsert)
            .select();

        if (insertErr) throw new Error("Failed to insert fixtures: " + insertErr.message);
        return inserted;
    }

    static async getPointsTable(tournament_id) {
        if (!tournament_id) throw new Error("Tournament ID is required for Points Table");

        const { data: teams } = await supabase.from('teams').select('*').eq('tournament_id', tournament_id);
        const { data: fixtures } = await supabase
            .from('fixtures')
            .select('*, match_scores(team_id, innings, runs, balls_bowled, extras)')
            .eq('tournament_id', tournament_id)
            .eq('status', 'completed')
            .in('match_type', ['League', 'league']); // Playoffs shouldn't affect League Points Table

        const table = {};
        teams.forEach(t => {
            table[t.id] = {
                team_id: t.id,
                team_name: t.team_name,
                matches_played: 0,
                wins: 0,
                losses: 0,
                ties: 0,
                points: 0,
                runs_scored: 0,
                balls_faced: 0,
                runs_conceded: 0,
                balls_bowled: 0,
                nrr: 0
            };
        });

        fixtures.forEach(fixture => {
            if (!fixture.match_scores || fixture.match_scores.length < 2) return;

            const scores = fixture.match_scores;
            let teamAScore, teamBScore;

            if (scores[0].team_id === fixture.team_a_id) {
                teamAScore = scores[0];
                teamBScore = scores[1];
            } else {
                teamAScore = scores[1];
                teamBScore = scores[0];
            }
            
            table[fixture.team_a_id].runs_scored += teamAScore.runs;
            table[fixture.team_a_id].balls_faced += teamAScore.balls_bowled;
            table[fixture.team_a_id].runs_conceded += teamBScore.runs;
            table[fixture.team_a_id].balls_bowled += teamBScore.balls_bowled;

            table[fixture.team_b_id].runs_scored += teamBScore.runs;
            table[fixture.team_b_id].balls_faced += teamBScore.balls_bowled;
            table[fixture.team_b_id].runs_conceded += teamAScore.runs;
            table[fixture.team_b_id].balls_bowled += teamAScore.balls_bowled;

            table[fixture.team_a_id].matches_played++;
            table[fixture.team_b_id].matches_played++;

            if (teamAScore.runs > teamBScore.runs) {
                table[fixture.team_a_id].wins++;
                table[fixture.team_a_id].points += 2;
                table[fixture.team_b_id].losses++;
            } else if (teamBScore.runs > teamAScore.runs) {
                table[fixture.team_b_id].wins++;
                table[fixture.team_b_id].points += 2;
                table[fixture.team_a_id].losses++;
            } else {
                table[fixture.team_a_id].ties++;
                table[fixture.team_a_id].points += 1;
                table[fixture.team_b_id].ties++;
                table[fixture.team_b_id].points += 1;
            }
        });

        Object.values(table).forEach(team => {
            const oversFaced = team.balls_faced / 6.0;
            const oversBowled = team.balls_bowled / 6.0;

            const runsPerOverScored = oversFaced > 0 ? (team.runs_scored / oversFaced) : 0;
            const runsPerOverConceded = oversBowled > 0 ? (team.runs_conceded / oversBowled) : 0;
            
            team.nrr = runsPerOverScored - runsPerOverConceded;
        });

        return Object.values(table).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            return b.nrr - a.nrr;
        });
    }

    static async generatePlayoffs(playoffOvers = 3, tournament_id) {
        if (!tournament_id) throw new Error("Tournament ID is required to generate playoffs");
        const table = await this.getPointsTable(tournament_id);
        const numTeams = table.length;

        if (numTeams < 4) throw new Error("At least 4 teams required for playoffs");

        // Verify playoffs haven't already been created
        const { data: check } = await supabase.from('fixtures').select('id').eq('tournament_id', tournament_id).in('match_type', ['SF1', 'SF2', 'Semifinal', 'Final']);
        if (check && check.length > 0) throw new Error("Playoff fixtures already exist for this tournament!");

        const playoffs = [];

        if (numTeams === 4) {
            playoffs.push({ label: 'Final', team_a: table[0].team_id, team_b: table[1].team_id });
        } else if (numTeams === 5) {
            playoffs.push({ label: 'Semifinal', team_a: table[1].team_id, team_b: table[2].team_id });
        } else {
            playoffs.push({ label: 'SF1', team_a: table[0].team_id, team_b: table[3].team_id });
            playoffs.push({ label: 'SF2', team_a: table[1].team_id, team_b: table[2].team_id });
        }

        const fixturesToInsert = playoffs.map(p => ({
            team_a_id: p.team_a,
            team_b_id: p.team_b,
            total_overs: playoffOvers,
            status: 'upcoming',
            tournament_id: tournament_id,
            match_type: p.label
        }));

        const { data: inserted } = await supabase
            .from('fixtures')
            .insert(fixturesToInsert)
            .select();

        return inserted;
    }
}

module.exports = TournamentService;
