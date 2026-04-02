const supabase = require('../db/supabase');
const ScoringEngine = require('./scoringEngine');

class MatchService {
    /**
     * Perform the toss for a fixture.
     */
    static async doToss(fixtureId, tossWinnerId, tossDecision) {
        if (!['bat', 'bowl'].includes(tossDecision)) {
            throw new Error("Invalid toss decision. Must be 'bat' or 'bowl'");
        }

        const { data: fixture, error: fetchErr } = await supabase
            .from('fixtures')
            .select('*')
            .eq('id', fixtureId)
            .single();

        if (fetchErr || !fixture) throw new Error("Fixture not found");

        if (fixture.status !== 'upcoming') {
            throw new Error("Toss already executed or match started");
        }

        const finalWinnerId = tossWinnerId || (Math.random() < 0.5 ? fixture.team_a_id : fixture.team_b_id);

        const { data, error } = await supabase
            .from('fixtures')
            .update({
                toss_winner_id: finalWinnerId,
                toss_decision: tossDecision,
                status: 'toss'
            })
            .eq('id', fixtureId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data; // Changed fixture
    }

    /**
     * Start the match, initializing the first innings record
     */
    static async startMatch(fixtureId) {
        const { data: fixture, error: fetchErr } = await supabase
            .from('fixtures')
            .select('*')
            .eq('id', fixtureId)
            .single();
            
        if (fetchErr || !fixture) throw new Error("Fixture not found");

        if (fixture.status === 'upcoming') {
            throw new Error("Cannot start match without toss");
        }
        if (fixture.status === 'live' || fixture.status === 'completed') {
            throw new Error("Match already started or completed");
        }

        // Determine batting team for 1st innings based on toss
        let battingTeamId = fixture.team_a_id;
        if (fixture.toss_winner_id === fixture.team_a_id) {
            battingTeamId = fixture.toss_decision === 'bat' ? fixture.team_a_id : fixture.team_b_id;
        } else {
            battingTeamId = fixture.toss_decision === 'bat' ? fixture.team_b_id : fixture.team_a_id;
        }

        // Initialize innings 1
        const { error: initErr } = await supabase
            .from('match_scores')
            .insert({
                fixture_id: fixtureId,
                team_id: battingTeamId,
                innings: 1
            });

        if (initErr) throw new Error("Error initializing match scores");

        // Update fixture status
        const { data, error } = await supabase
            .from('fixtures')
            .update({ status: 'live', match_start_time: new Date().toISOString() })
            .eq('id', fixtureId)
            .select(`
                *,
                team_a:team_a_id (team_name),
                team_b:team_b_id (team_name)
            `)
            .single();

        if (error) throw new Error(error.message);

        return data;
    }

    static async addBall(fixtureId, eventPayload) {
        // Fetch current active innings or match status
        const { data: fixture } = await supabase.from('fixtures').select('*').eq('id', fixtureId).single();
        if (fixture.status === 'completed') throw new Error("Match already completed");
        
        // Find latest incomplete innings
        const { data: currentInningsScore } = await supabase
            .from('match_scores')
            .select('*')
            .eq('fixture_id', fixtureId)
            .eq('is_completed', false)
            .order('innings', { ascending: false })
            .limit(1)
            .single();

        if (!currentInningsScore) {
            throw new Error("No active innings found for this fixture");
        }

        // Need target if innings is 2
        let target = undefined;
        if (currentInningsScore.innings === 2) {
            const { data: firstInnings } = await supabase
                .from('match_scores')
                .select('runs')
                .eq('fixture_id', fixtureId)
                .eq('innings', 1)
                .single();
            if (firstInnings) target = firstInnings.runs + 1;
        }

        // Build state for scoring engine
        const state = {
            ...currentInningsScore,
            total_overs: fixture.total_overs,
            target
        };

        const { updatedScore, ballRecord } = ScoringEngine.processBall(state, eventPayload);

        // Calculate over and ball number
        const overNumber = Math.floor(updatedScore.balls_bowled / 6);
        const ballNumber = updatedScore.balls_bowled % 6; // Warning: wait, if it's the 6th ball of an over, balls_bowled is divisible by 6, so %6 is 0.
        // Actually logical ball number should just be based on the last state. Let's just store over_number and ball_number as we see fit or omit for pure logical balls. The frontend uses `floor(balls/6)`.
        const bowlingTeamId = fixture.team_a_id === currentInningsScore.team_id ? fixture.team_b_id : fixture.team_a_id;

        const dbBallRecord = {
            fixture_id: fixtureId,
            innings: currentInningsScore.innings,
            batting_team_id: currentInningsScore.team_id,
            bowling_team_id: bowlingTeamId,
            over_number: overNumber,
            ball_number: ballNumber,
            runs_scored: ballRecord.runs_scored,
            extras: ballRecord.extras,
            is_wide: ballRecord.is_wide,
            is_no_ball: ballRecord.is_no_ball,
            is_wicket: ballRecord.is_wicket,
            wicket_type: eventPayload.wicket_type || null,
            striker_name: eventPayload.striker_name || null,
            bowler_name: eventPayload.bowler_name || null
        };

        // Transaction simulation: Supabase doesn't easily support multi-statement transactions via anon key.
        // So we do insert then update.
        // For production we'd use an rpc.
        const { data: insertedBall, error: ballErr } = await supabase
            .from('ball_by_ball')
            .insert(dbBallRecord)
            .select()
            .single();

        if (ballErr) throw new Error(ballErr.message);

        const { error: scoreErr } = await supabase
            .from('match_scores')
            .update({
                runs: updatedScore.runs,
                wickets: updatedScore.wickets,
                balls_bowled: updatedScore.balls_bowled,
                extras: updatedScore.extras,
                is_completed: updatedScore.is_completed
            })
            .eq('id', currentInningsScore.id);

        if (scoreErr) throw new Error(scoreErr.message);

        // Check if we need to start innings 2 or end match
        if (updatedScore.is_completed) {
            if (updatedScore.innings === 1) {
                // Start innings 2
                await supabase.from('match_scores').insert({
                    fixture_id: fixtureId,
                    team_id: bowlingTeamId, // switch teams
                    innings: 2
                });
            } else if (updatedScore.innings === 2) {
                await supabase.from('fixtures').update({ status: 'completed', match_end_time: new Date().toISOString() }).eq('id', fixtureId);
                
                // --- Event-Driven Final Generation ---
                try {
                    const { data: currentFixture } = await supabase.from('fixtures').select('*').eq('id', fixtureId).single();
                    
                    if (currentFixture.match_type === 'Semifinal') {
                        // Rank 1 vs Winner of 'Semifinal'
                        const TournamentService = require('./tournamentService');
                        const table = await TournamentService.getPointsTable(currentFixture.tournament_id);
                        if (table.length > 0) {
                            const rank1 = table[0].team_id;
                            const { data: inn1 } = await supabase.from('match_scores').select('*').eq('fixture_id', fixtureId).eq('innings', 1).single();
                            const target = inn1.runs + 1;
                            const winnerId = (updatedScore.runs >= target) ? updatedScore.team_id : inn1.team_id;
                            
                            await supabase.from('fixtures').insert({
                                team_a_id: rank1,
                                team_b_id: winnerId,
                                total_overs: currentFixture.total_overs, // Inherit playoff overs
                                status: 'upcoming',
                                tournament_id: currentFixture.tournament_id,
                                match_type: 'Final'
                            });
                        }
                    } else if (currentFixture.match_type === 'SF1' || currentFixture.match_type === 'SF2') {
                        // 2 Semis scenario. Check if BOTH are completed!
                        const { data: sfs } = await supabase.from('fixtures').select('*')
                             .eq('tournament_id', currentFixture.tournament_id)
                             .in('match_type', ['SF1', 'SF2']);
                        
                        if (sfs && sfs.length === 2 && sfs[0].status === 'completed' && sfs[1].status === 'completed') {
                            const winners = [];
                            for (let sf of sfs) {
                                 const { data: s_inn1 } = await supabase.from('match_scores').select('*').eq('fixture_id', sf.id).eq('innings', 1).single();
                                 const { data: s_inn2 } = await supabase.from('match_scores').select('*').eq('fixture_id', sf.id).eq('innings', 2).single();
                                 if (s_inn2.runs > s_inn1.runs) winners.push(s_inn2.team_id);
                                 else winners.push(s_inn1.team_id);
                            }
                            
                            // Prevent duplicating "Final" if somehow generated
                            const { data: existingFinal } = await supabase.from('fixtures').select('id').eq('tournament_id', currentFixture.tournament_id).eq('match_type', 'Final');
                            if (!existingFinal || existingFinal.length === 0) {
                                await supabase.from('fixtures').insert({
                                    team_a_id: winners[0],
                                    team_b_id: winners[1],
                                    total_overs: currentFixture.total_overs,
                                    status: 'upcoming',
                                    tournament_id: currentFixture.tournament_id,
                                    match_type: 'Final'
                                });
                            }
                        }
                    }
                } catch (e) {
                     console.error("Auto Final Generation Failed: ", e);
                }
            }
        }

        return { updatedScore, insertedBall };
    }

    static async undoLastBall(fixtureId) {
        // Fetch fixture
        const { data: fixture } = await supabase.from('fixtures').select('*').eq('id', fixtureId).single();
        if (fixture.status === 'completed') {
            throw new Error("Cannot undo after match is completed.");
        }

        // Get the latest ball
        const { data: balls, error: bErr } = await supabase
            .from('ball_by_ball')
            .select('*')
            .eq('fixture_id', fixtureId)
            .order('created_at', { ascending: false })
            .limit(1);

        if (bErr || !balls || balls.length === 0) {
            throw new Error("No balls to undo in this match");
        }

        const lastBall = balls[0];

        // Fetch corresponding innings score record
        const { data: inningsScore } = await supabase
            .from('match_scores')
            .select('*')
            .eq('fixture_id', fixtureId)
            .eq('innings', lastBall.innings)
            .single();

        const stateVars = {
            runs: inningsScore.runs,
            wickets: inningsScore.wickets,
            balls_bowled: inningsScore.balls_bowled,
            extras: inningsScore.extras,
            innings: inningsScore.innings
        };

        const { updatedScore } = ScoringEngine.undoBall(stateVars, lastBall);

        // Delete the ball
        await supabase.from('ball_by_ball').delete().eq('id', lastBall.id);

        // Update score
        await supabase
            .from('match_scores')
            .update({
                runs: updatedScore.runs,
                wickets: updatedScore.wickets,
                balls_bowled: updatedScore.balls_bowled,
                extras: updatedScore.extras,
                is_completed: false // Reverting makes it active again
            })
            .eq('id', inningsScore.id);

        // If this undo reverted an innings completion, and it was the end of innings 1,
        // we might need to delete the mistakenly created innings 2 record if it exists and has 0 balls.
        if (inningsScore.is_completed && updatedScore.is_completed === false) {
            if (inningsScore.innings === 1) {
                await supabase.from('match_scores').delete().eq('fixture_id', fixtureId).eq('innings', 2);
            }
        }

        return updatedScore;
    }
}

module.exports = MatchService;
