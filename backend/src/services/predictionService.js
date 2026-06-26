const supabase = require('../db/supabase');

/**
 * AI Match Prediction Engine
 * 
 * Uses a multi-factor weighted model derived from historical ball-by-ball data
 * to predict match outcomes. Works for both pre-match predictions and
 * enhanced live (2nd innings) win probability calculations.
 * 
 * Factors:
 *   1. Win Rate (25%)          - Historical W/L ratio
 *   2. Batting Strength (20%)  - Average runs per over
 *   3. Bowling Strength (15%)  - Average economy rate
 *   4. Recent Form (15%)       - Last 3 matches momentum
 *   5. Head-to-Head (10%)      - Direct record between teams
 *   6. Boundary Power (8%)     - 4s/6s per ball ratio
 *   7. Discipline (7%)         - Extras conceded rate
 */
class PredictionService {

    /**
     * Generate a full pre-match prediction for a given fixture.
     * Analyzes all historical data within the same tournament.
     */
    static async predictMatch(fixtureId) {
        // 1. Fetch the fixture details
        const { data: fixture, error: fErr } = await supabase
            .from('fixtures')
            .select('*, team_a:teams!team_a_id(*), team_b:teams!team_b_id(*)')
            .eq('id', fixtureId)
            .single();

        if (fErr || !fixture) throw new Error('Fixture not found');

        const teamA = fixture.team_a;
        const teamB = fixture.team_b;
        const tournamentId = fixture.tournament_id;

        // 2. Fetch ALL completed fixtures in this tournament (for historical stats)
        const { data: allFixtures } = await supabase
            .from('fixtures')
            .select('*, match_scores(team_id, innings, runs, wickets, balls_bowled, extras, is_completed)')
            .eq('tournament_id', tournamentId)
            .eq('status', 'completed');

        // 3. Fetch ALL ball-by-ball data for the tournament
        const fixtureIds = (allFixtures || []).map(f => f.id);
        let allBalls = [];
        if (fixtureIds.length > 0) {
            const { data: balls } = await supabase
                .from('ball_by_ball')
                .select('*')
                .in('fixture_id', fixtureIds);
            allBalls = balls || [];
        }

        // 4. Compute stats for each team
        const statsA = this._computeTeamStats(teamA.id, allFixtures || [], allBalls);
        const statsB = this._computeTeamStats(teamB.id, allFixtures || [], allBalls);

        // 5. Head-to-Head
        const h2h = this._computeH2H(teamA.id, teamB.id, allFixtures || []);

        // 6. Compute weighted prediction scores
        const scoreA = this._computeWeightedScore(statsA, statsB, h2h, 'A');
        const scoreB = this._computeWeightedScore(statsB, statsA, h2h, 'B');

        // 7. Normalize to percentages
        const total = scoreA + scoreB;
        let probA = total > 0 ? Math.round((scoreA / total) * 100) : 50;
        let probB = 100 - probA;

        // Clamp to avoid extreme predictions (5-95 range)
        probA = Math.max(5, Math.min(95, probA));
        probB = 100 - probA;

        // 8. Generate insight text
        const insights = this._generateInsights(teamA, teamB, statsA, statsB, h2h, probA);

        return {
            fixture_id: fixtureId,
            team_a: {
                id: teamA.id,
                name: teamA.team_name,
                probability: probA,
                stats: statsA
            },
            team_b: {
                id: teamB.id,
                name: teamB.team_name,
                probability: probB,
                stats: statsB
            },
            head_to_head: h2h,
            insights,
            model_version: '1.0',
            factors: {
                win_rate: { weight: 0.25, label: 'Win Rate' },
                batting: { weight: 0.20, label: 'Batting Strength' },
                bowling: { weight: 0.15, label: 'Bowling Strength' },
                form: { weight: 0.15, label: 'Recent Form' },
                h2h: { weight: 0.10, label: 'Head-to-Head' },
                boundary_power: { weight: 0.08, label: 'Boundary Power' },
                discipline: { weight: 0.07, label: 'Discipline' }
            }
        };
    }

    /**
     * Compute comprehensive team statistics from historical data.
     */
    static _computeTeamStats(teamId, fixtures, balls) {
        const stats = {
            matches_played: 0,
            wins: 0,
            losses: 0,
            ties: 0,
            total_runs_scored: 0,
            total_balls_faced: 0,
            total_runs_conceded: 0,
            total_balls_bowled: 0,
            total_fours: 0,
            total_sixes: 0,
            total_batting_balls: 0,   // for boundary rate
            total_extras_conceded: 0,
            total_bowling_deliveries: 0,
            total_wickets_taken: 0,
            // Recent form (last 3 matches)
            recent_results: [],
            // Chase stats
            chases_won: 0,
            chases_played: 0
        };

        // Process fixtures for win/loss and score stats
        fixtures.forEach(fix => {
            if (!fix.match_scores || fix.match_scores.length < 2) return;
            const isTeamInMatch = fix.team_a_id === teamId || fix.team_b_id === teamId;
            if (!isTeamInMatch) return;

            stats.matches_played++;

            const teamScore = fix.match_scores.find(s => s.team_id === teamId);
            const oppScore = fix.match_scores.find(s => s.team_id !== teamId);
            if (!teamScore || !oppScore) return;

            stats.total_runs_scored += teamScore.runs || 0;
            stats.total_balls_faced += teamScore.balls_bowled || 0;
            stats.total_runs_conceded += oppScore.runs || 0;
            stats.total_balls_bowled += oppScore.balls_bowled || 0;

            // Determine winner
            if (teamScore.runs > oppScore.runs) {
                stats.wins++;
                stats.recent_results.push('W');
            } else if (teamScore.runs < oppScore.runs) {
                stats.losses++;
                stats.recent_results.push('L');
            } else {
                stats.ties++;
                stats.recent_results.push('T');
            }

            // Chase stats
            if (teamScore.innings === 2) {
                stats.chases_played++;
                if (teamScore.runs > oppScore.runs) {
                    stats.chases_won++;
                }
            }
        });

        // Process ball-by-ball for detailed metrics
        const teamBattingBalls = balls.filter(b => b.batting_team_id === teamId);
        const teamBowlingBalls = balls.filter(b => b.bowling_team_id === teamId);

        teamBattingBalls.forEach(b => {
            if (!b.is_wide) {
                stats.total_batting_balls++;
                if (b.runs_scored === 4) stats.total_fours++;
                if (b.runs_scored === 6) stats.total_sixes++;
            }
        });

        teamBowlingBalls.forEach(b => {
            stats.total_bowling_deliveries++;
            stats.total_extras_conceded += (b.extras || 0);
            if (b.is_wicket) stats.total_wickets_taken++;
        });

        // Compute derived metrics
        const oversFaced = stats.total_balls_faced / 6;
        const oversBowled = stats.total_balls_bowled / 6;

        stats.batting_avg_rpo = oversFaced > 0 ? +(stats.total_runs_scored / oversFaced).toFixed(2) : 0;
        stats.bowling_avg_economy = oversBowled > 0 ? +(stats.total_runs_conceded / oversBowled).toFixed(2) : 0;
        stats.win_rate = stats.matches_played > 0 ? +(stats.wins / stats.matches_played).toFixed(3) : 0;
        stats.boundary_rate = stats.total_batting_balls > 0 
            ? +((stats.total_fours + stats.total_sixes) / stats.total_batting_balls).toFixed(3) : 0;
        stats.extras_rate = stats.total_bowling_deliveries > 0
            ? +(stats.total_extras_conceded / stats.total_bowling_deliveries).toFixed(3) : 0;
        stats.chase_win_rate = stats.chases_played > 0
            ? +(stats.chases_won / stats.chases_played).toFixed(3) : 0;

        // Keep only last 3 for recent form
        stats.recent_results = stats.recent_results.slice(-3);
        stats.recent_form_score = stats.recent_results.reduce((sum, r) => {
            if (r === 'W') return sum + 1;
            if (r === 'T') return sum + 0.5;
            return sum;
        }, 0) / Math.max(stats.recent_results.length, 1);

        return stats;
    }

    /**
     * Compute head-to-head record between two teams.
     */
    static _computeH2H(teamAId, teamBId, fixtures) {
        const h2h = { team_a_wins: 0, team_b_wins: 0, draws: 0, total: 0 };

        fixtures.forEach(fix => {
            const isH2H = (fix.team_a_id === teamAId && fix.team_b_id === teamBId)
                       || (fix.team_a_id === teamBId && fix.team_b_id === teamAId);
            if (!isH2H || !fix.match_scores || fix.match_scores.length < 2) return;

            h2h.total++;

            const scoreA = fix.match_scores.find(s => s.team_id === teamAId);
            const scoreB = fix.match_scores.find(s => s.team_id === teamBId);
            if (!scoreA || !scoreB) return;

            if (scoreA.runs > scoreB.runs) h2h.team_a_wins++;
            else if (scoreB.runs > scoreA.runs) h2h.team_b_wins++;
            else h2h.draws++;
        });

        return h2h;
    }

    /**
     * Compute the weighted prediction score for a team.
     * Higher score = more likely to win.
     */
    static _computeWeightedScore(myStats, oppStats, h2h, side) {
        const W = {
            win_rate: 0.25,
            batting: 0.20,
            bowling: 0.15,
            form: 0.15,
            h2h: 0.10,
            boundary: 0.08,
            discipline: 0.07
        };

        let score = 0;

        // 1. Win Rate (0-1 scale)
        score += W.win_rate * (myStats.win_rate || 0.5);

        // 2. Batting Strength — normalize RPO (typical street cricket range: 4-15 RPO)
        const battingNorm = Math.min(1, Math.max(0, (myStats.batting_avg_rpo || 6) / 15));
        score += W.batting * battingNorm;

        // 3. Bowling Strength — lower economy is better, invert the scale
        //    Typical economy: 4-15. We want low economy → high score.
        const bowlingNorm = Math.min(1, Math.max(0, 1 - ((myStats.bowling_avg_economy || 10) / 20)));
        score += W.bowling * bowlingNorm;

        // 4. Recent Form (0-1 scale, already computed)
        score += W.form * (myStats.recent_form_score || 0.5);

        // 5. Head-to-Head
        const myH2HWins = side === 'A' ? h2h.team_a_wins : h2h.team_b_wins;
        const h2hScore = h2h.total > 0 ? (myH2HWins / h2h.total) : 0.5;
        score += W.h2h * h2hScore;

        // 6. Boundary Power (typical range: 0-0.4)
        const boundaryNorm = Math.min(1, (myStats.boundary_rate || 0) / 0.4);
        score += W.boundary * boundaryNorm;

        // 7. Discipline — lower extras rate is better
        const disciplineNorm = Math.min(1, Math.max(0, 1 - ((myStats.extras_rate || 0) / 0.3)));
        score += W.discipline * disciplineNorm;

        // If no matches played (brand new team), return baseline 0.5
        if (myStats.matches_played === 0) return 0.5;

        return score;
    }

    /**
     * Generate human-readable AI insights about the prediction.
     */
    static _generateInsights(teamA, teamB, statsA, statsB, h2h, probA) {
        const insights = [];

        // No data scenario
        if (statsA.matches_played === 0 && statsB.matches_played === 0) {
            return ['🔮 First match for both teams — prediction is based on equal probability.'];
        }

        // Win rate insight
        if (statsA.win_rate > statsB.win_rate + 0.15) {
            insights.push(`📊 ${teamA.team_name} has a significantly better win rate (${(statsA.win_rate * 100).toFixed(0)}% vs ${(statsB.win_rate * 100).toFixed(0)}%).`);
        } else if (statsB.win_rate > statsA.win_rate + 0.15) {
            insights.push(`📊 ${teamB.team_name} has a significantly better win rate (${(statsB.win_rate * 100).toFixed(0)}% vs ${(statsA.win_rate * 100).toFixed(0)}%).`);
        }

        // Batting comparison
        if (statsA.batting_avg_rpo > statsB.batting_avg_rpo + 2) {
            insights.push(`🏏 ${teamA.team_name} has a stronger batting lineup (${statsA.batting_avg_rpo} RPO vs ${statsB.batting_avg_rpo} RPO).`);
        } else if (statsB.batting_avg_rpo > statsA.batting_avg_rpo + 2) {
            insights.push(`🏏 ${teamB.team_name} has a stronger batting lineup (${statsB.batting_avg_rpo} RPO vs ${statsA.batting_avg_rpo} RPO).`);
        }

        // Bowling comparison
        if (statsA.bowling_avg_economy < statsB.bowling_avg_economy - 1.5) {
            insights.push(`⚾ ${teamA.team_name} has tighter bowling (${statsA.bowling_avg_economy} econ vs ${statsB.bowling_avg_economy}).`);
        } else if (statsB.bowling_avg_economy < statsA.bowling_avg_economy - 1.5) {
            insights.push(`⚾ ${teamB.team_name} has tighter bowling (${statsB.bowling_avg_economy} econ vs ${statsA.bowling_avg_economy}).`);
        }

        // Head-to-head
        if (h2h.total > 0) {
            insights.push(`🤝 H2H Record: ${teamA.team_name} ${h2h.team_a_wins}-${h2h.team_b_wins} ${teamB.team_name} (${h2h.draws} ties).`);
        }

        // Recent form
        const formA = statsA.recent_results.join('');
        const formB = statsB.recent_results.join('');
        if (formA || formB) {
            insights.push(`🔥 Recent Form — ${teamA.team_name}: ${formA || 'N/A'} | ${teamB.team_name}: ${formB || 'N/A'}`);
        }

        // Boundary power
        if (statsA.boundary_rate > statsB.boundary_rate * 1.5 && statsA.boundary_rate > 0.1) {
            insights.push(`💥 ${teamA.team_name} hits significantly more boundaries (${(statsA.boundary_rate * 100).toFixed(1)}% boundary rate).`);
        } else if (statsB.boundary_rate > statsA.boundary_rate * 1.5 && statsB.boundary_rate > 0.1) {
            insights.push(`💥 ${teamB.team_name} hits significantly more boundaries (${(statsB.boundary_rate * 100).toFixed(1)}% boundary rate).`);
        }

        // Overall prediction summary
        const favTeam = probA >= 50 ? teamA.team_name : teamB.team_name;
        const favProb = Math.max(probA, 100 - probA);
        if (favProb > 70) {
            insights.push(`🌟 ${favTeam} are strong favorites at ${favProb}%.`);
        } else if (favProb > 55) {
            insights.push(`⚖️ ${favTeam} have a slight edge at ${favProb}%.`);
        } else {
            insights.push(`🔮 This looks like a very close contest!`);
        }

        return insights;
    }

    /**
     * Enhanced live win probability calculation for 2nd innings chase.
     * Much more sophisticated than the basic CRR vs RRR model.
     */
    static calculateLiveWinProbability(activeScore, targetRuns, totalOvers, teamStats = null) {
        if (!activeScore || !targetRuns) return null;

        const runsNeeded = targetRuns - (activeScore.runs || 0);
        const totalBalls = totalOvers * 6;
        const ballsFaced = activeScore.balls_bowled || 0;
        const ballsLeft = totalBalls - ballsFaced;
        const wicketsLost = activeScore.wickets || 0;
        const maxWickets = 2; // Street cricket: 3 players, max 2 wickets

        // Already won
        if (runsNeeded <= 0) return 100;
        // All out or no balls left
        if (ballsLeft <= 0 || wicketsLost >= maxWickets) return 0;

        // Factor 1: Run Rate Comparison (35% weight)
        const crr = ballsFaced > 0 ? (activeScore.runs / ballsFaced) * 6 : 0;
        const rrr = (runsNeeded / ballsLeft) * 6;
        const rateRatio = rrr > 0 ? crr / rrr : 2;
        const rateFactor = Math.min(1, Math.max(0, 0.3 + (rateRatio - 0.5) * 0.7));

        // Factor 2: Wickets in Hand (25% weight)
        // In street cricket (3 players), wickets are extremely valuable
        const wicketsFactor = wicketsLost === 0 ? 0.85 : (wicketsLost === 1 ? 0.45 : 0.1);

        // Factor 3: Match Progress Pressure (20% weight)
        // Easier to score in early overs, harder under pressure at death
        const progressRatio = ballsFaced / totalBalls;
        const runsPerBallNeeded = ballsLeft > 0 ? runsNeeded / ballsLeft : 99;
        let pressureFactor;
        if (runsPerBallNeeded <= 0.8) pressureFactor = 0.85;
        else if (runsPerBallNeeded <= 1.2) pressureFactor = 0.65;
        else if (runsPerBallNeeded <= 1.8) pressureFactor = 0.4;
        else if (runsPerBallNeeded <= 2.5) pressureFactor = 0.2;
        else pressureFactor = 0.05;

        // Factor 4: Momentum (10% weight) — how many runs in the last 6 balls
        // (This would ideally use actual ball data, but we estimate from CRR)
        const momentumFactor = crr > rrr * 1.2 ? 0.8 : (crr > rrr * 0.8 ? 0.5 : 0.2);

        // Factor 5: Historical Chase Ability (10% weight)
        const chaseAbility = teamStats?.chase_win_rate ?? 0.5;

        // Weighted combination
        const probability =
            rateFactor * 0.35 +
            wicketsFactor * 0.25 +
            pressureFactor * 0.20 +
            momentumFactor * 0.10 +
            chaseAbility * 0.10;

        // Convert to percentage and clamp
        return Math.round(Math.max(3, Math.min(97, probability * 100)));
    }
}

module.exports = PredictionService;
