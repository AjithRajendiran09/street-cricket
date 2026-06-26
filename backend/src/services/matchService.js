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

        const bowlingTeamId = battingTeamId === fixture.team_a_id ? fixture.team_b_id : fixture.team_a_id;

        // Set default innings order for the match
        const inningsCount = fixture.innings_count || 2;
        let inningsOrder;
        if (inningsCount === 4) {
            // Test match: A -> B -> A -> B
            inningsOrder = [battingTeamId, bowlingTeamId, battingTeamId, bowlingTeamId];
        } else {
            inningsOrder = [battingTeamId, bowlingTeamId];
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

        // Update fixture status and set innings order
        const { data, error } = await supabase
            .from('fixtures')
            .update({
                status: 'live',
                match_start_time: new Date().toISOString(),
                innings_order: JSON.stringify(inningsOrder)
            })
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

    /**
     * Helper: get the number of players in a team (from players JSONB or legacy columns).
     */
    static _getPlayerCount(team) {
        // Try JSONB players array first
        if (team.players && Array.isArray(team.players)) {
            return team.players.length;
        }
        // Legacy fallback: count non-null player columns
        let count = 0;
        if (team.player1_name) count += 1;
        if (team.player2_name) count += 1;
        if (team.player3_name) count += 1;
        return count;
    }

    /**
     * Helper: get tournament format for a fixture.
     */
    static async _getFormat(fixture) {
        if (!fixture.tournament_id) return 'league';
        const { data: tournament } = await supabase.from('tournaments')
            .select('format').eq('id', fixture.tournament_id).single();
        return tournament?.format || 'league';
    }

    static async addBall(fixtureId, eventPayload) {
        // Fetch current active innings or match status
        const { data: fixture } = await supabase.from('fixtures').select('*').eq('id', fixtureId).single();
        if (fixture.status === 'completed') throw new Error("Match already completed");
        
        const format = await this._getFormat(fixture);
        const inningsCount = fixture.innings_count || 2;

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

        // Need target for chasing innings
        let target = undefined;
        if (format === 'test') {
            // In test match, target only applies in the final innings (4th, or 3rd if follow-on)
            const finalInningsNum = inningsCount; // Usually 4
            if (currentInningsScore.innings === finalInningsNum) {
                // Calculate total runs by the other team across all their innings
                const { data: allScores } = await supabase.from('match_scores')
                    .select('*').eq('fixture_id', fixtureId);
                
                const chasingTeamId = currentInningsScore.team_id;
                let chasingRuns = 0;
                let settingRuns = 0;
                
                allScores.forEach(s => {
                    if (s.team_id === chasingTeamId) {
                        if (s.innings !== currentInningsScore.innings) {
                            chasingRuns += s.runs;
                        }
                    } else {
                        settingRuns += s.runs;
                    }
                });
                
                target = settingRuns - chasingRuns + 1;
            }
        } else {
            // League/Knockout: target is in innings 2
            if (currentInningsScore.innings === 2) {
                const { data: firstInnings } = await supabase
                    .from('match_scores')
                    .select('runs')
                    .eq('fixture_id', fixtureId)
                    .eq('innings', 1)
                    .single();
                if (firstInnings) target = firstInnings.runs + 1;
            }
        }

        // Determine structural max wickets
        const { data: activeTeam } = await supabase.from('teams').select('*').eq('id', currentInningsScore.team_id).single();
        const maxWickets = this._getPlayerCount(activeTeam);

        // Build state for scoring engine
        const state = {
            ...currentInningsScore,
            total_overs: fixture.total_overs,
            max_overs_per_innings: fixture.max_overs_per_innings,
            target,
            max_wickets: maxWickets,
            format,
            innings_count: inningsCount
        };

        const { updatedScore, ballRecord } = ScoringEngine.processBall(state, eventPayload);

        // Calculate over and ball number
        const overNumber = Math.floor(updatedScore.balls_bowled / 6);
        const ballNumber = updatedScore.balls_bowled % 6;
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

        // Check if we need to start next innings or end match
        if (updatedScore.is_completed) {
            const currentInningsNum = updatedScore.innings;

            if (format === 'test') {
                // Test match innings transition
                if (currentInningsNum >= inningsCount) {
                    // All innings done — match completed
                    await supabase.from('fixtures').update({ status: 'completed', match_end_time: new Date().toISOString() }).eq('id', fixtureId);
                } else if (currentInningsNum === 2) {
                    // After innings 2 in test match — check follow-on eligibility
                    // Don't auto-start innings 3. Return follow-on info to frontend.
                    const TestMatchService = require('./testMatchService');
                    try {
                        const followOnCheck = await TestMatchService.checkFollowOn(fixtureId);
                        if (followOnCheck.canEnforceFollowOn) {
                            return {
                                updatedScore, insertedBall,
                                followOnEligible: true,
                                followOnData: followOnCheck
                            };
                        }
                    } catch (e) {
                        // Follow-on not applicable, continue normally
                    }

                    // No follow-on — start innings 3 normally
                    const inningsOrder = fixture.innings_order
                        ? (typeof fixture.innings_order === 'string' ? JSON.parse(fixture.innings_order) : fixture.innings_order)
                        : null;

                    const nextTeamId = inningsOrder ? inningsOrder[2] : currentInningsScore.team_id;
                    // Actually in default order, innings 3 is batted by team that batted innings 1
                    const { data: inn1 } = await supabase.from('match_scores')
                        .select('team_id').eq('fixture_id', fixtureId).eq('innings', 1).single();
                    const nextBattingTeam = inningsOrder ? inningsOrder[2] : (inn1?.team_id || bowlingTeamId);

                    await supabase.from('match_scores').insert({
                        fixture_id: fixtureId,
                        team_id: nextBattingTeam,
                        innings: 3
                    });

                    // Also set innings_order if not set
                    if (!fixture.innings_order && inn1) {
                        const inn2Team = currentInningsScore.team_id;
                        await supabase.from('fixtures').update({
                            innings_order: JSON.stringify([inn1.team_id, inn2Team, inn1.team_id, inn2Team])
                        }).eq('id', fixtureId);
                    }
                } else if (currentInningsNum === 3) {
                    // Start innings 4
                    const inningsOrder = fixture.innings_order
                        ? (typeof fixture.innings_order === 'string' ? JSON.parse(fixture.innings_order) : fixture.innings_order)
                        : null;
                    
                    let nextBattingTeam;
                    if (inningsOrder) {
                        nextBattingTeam = inningsOrder[3];
                    } else {
                        // Default: team that batted innings 2
                        const { data: inn2 } = await supabase.from('match_scores')
                            .select('team_id').eq('fixture_id', fixtureId).eq('innings', 2).single();
                        nextBattingTeam = inn2?.team_id || bowlingTeamId;
                    }

                    // Check if team batting 4th even needs to bat
                    // (if they already lead, match might be over)
                    const { data: allScores } = await supabase.from('match_scores')
                        .select('*').eq('fixture_id', fixtureId);
                    
                    let team4Runs = 0;
                    let otherTeamRuns = 0;
                    allScores.forEach(s => {
                        if (s.team_id === nextBattingTeam) team4Runs += s.runs;
                        else otherTeamRuns += s.runs;
                    });

                    if (team4Runs > otherTeamRuns) {
                        // Team batting 4th already leads — they win by innings!
                        await supabase.from('fixtures').update({
                            status: 'completed', match_end_time: new Date().toISOString()
                        }).eq('id', fixtureId);
                    } else {
                        await supabase.from('match_scores').insert({
                            fixture_id: fixtureId,
                            team_id: nextBattingTeam,
                            innings: 4
                        });
                    }
                } else {
                    // Innings 1 completed — start innings 2
                    await supabase.from('match_scores').insert({
                        fixture_id: fixtureId,
                        team_id: bowlingTeamId,
                        innings: 2
                    });
                }
            } else {
                // League / Knockout format (2 innings)
                if (currentInningsNum === 1) {
                    // Start innings 2
                    await supabase.from('match_scores').insert({
                        fixture_id: fixtureId,
                        team_id: bowlingTeamId, // switch teams
                        innings: 2
                    });
                } else if (currentInningsNum === 2) {
                    await supabase.from('fixtures').update({ status: 'completed', match_end_time: new Date().toISOString() }).eq('id', fixtureId);
                    
                    // --- Knockout: advance winner ---
                    if (format === 'knockout' && fixture.next_fixture_id) {
                        try {
                            const KnockoutService = require('./knockoutService');
                            await KnockoutService.advanceWinner(fixtureId);
                        } catch (e) {
                            console.error("Knockout auto-advance failed:", e);
                        }
                    }

                    // --- Event-Driven Final Generation (League format) ---
                    if (format === 'league') {
                        try {
                            const { data: currentFixture } = await supabase.from('fixtures').select('*').eq('id', fixtureId).single();
                            
                            if (currentFixture.match_type === 'Semifinal') {
                                const TournamentService = require('./tournamentService');
                                const table = await TournamentService.getPointsTable(currentFixture.tournament_id);
                                if (table.length > 0) {
                                    const rank1 = table[0].team_id;
                                    const { data: inn1 } = await supabase.from('match_scores').select('*').eq('fixture_id', fixtureId).eq('innings', 1).single();
                                    const autoTarget = inn1.runs + 1;
                                    const winnerId = (updatedScore.runs >= autoTarget) ? updatedScore.team_id : inn1.team_id;
                                    
                                    await supabase.from('fixtures').insert({
                                        team_a_id: rank1,
                                        team_b_id: winnerId,
                                        total_overs: currentFixture.total_overs,
                                        status: 'upcoming',
                                        tournament_id: currentFixture.tournament_id,
                                        match_type: 'Final'
                                    });
                                }
                            } else if (currentFixture.match_type === 'SF1' || currentFixture.match_type === 'SF2') {
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
            }
        }

        return { updatedScore, insertedBall };
    }

    static async undoLastBall(fixtureId) {
        // Fetch fixture
        const { data: fixture } = await supabase.from('fixtures').select('*').eq('id', fixtureId).single();
        if (fixture.status === 'completed') {
            // Unlock Match and set back to LIVE implicitly!
            await supabase.from('fixtures').update({ status: 'live', match_end_time: null }).eq('id', fixtureId);
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

        // If this undo reverted an innings completion, and it was the end of an innings,
        // we might need to delete the mistakenly created next innings record if it exists and has 0 balls.
        if (inningsScore.is_completed && updatedScore.is_completed === false) {
            const nextInnings = inningsScore.innings + 1;
            // Delete empty next innings (if any)
            const { data: nextInn } = await supabase.from('match_scores')
                .select('*').eq('fixture_id', fixtureId).eq('innings', nextInnings).single();
            
            if (nextInn && nextInn.balls_bowled === 0 && nextInn.runs === 0) {
                await supabase.from('match_scores').delete().eq('fixture_id', fixtureId).eq('innings', nextInnings);
            }
        }

        return updatedScore;
    }
}

module.exports = MatchService;
