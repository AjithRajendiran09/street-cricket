const supabase = require('../db/supabase');

class TestMatchService {
    /**
     * Check if follow-on can be enforced after Team B's 1st innings.
     * Follow-on is eligible when Team B's total is less than Team A's
     * by at least `follow_on_margin` runs.
     */
    static async checkFollowOn(fixtureId) {
        const { data: fixture } = await supabase.from('fixtures')
            .select('*').eq('id', fixtureId).single();

        if (!fixture) throw new Error("Fixture not found");
        if (fixture.innings_count !== 4) throw new Error("Follow-on only applies to test matches");

        // Get innings 1 and 2
        const { data: scores } = await supabase.from('match_scores')
            .select('*').eq('fixture_id', fixtureId).order('innings', { ascending: true });

        const inn1 = scores?.find(s => s.innings === 1);
        const inn2 = scores?.find(s => s.innings === 2);

        if (!inn1 || !inn2) throw new Error("Both innings 1 and 2 must be completed");
        if (!inn2.is_completed) throw new Error("Innings 2 is not completed yet");

        const deficit = inn1.runs - inn2.runs;
        const margin = fixture.follow_on_margin || 50;
        const canEnforceFollowOn = deficit >= margin;

        return {
            canEnforceFollowOn,
            deficit,
            margin,
            teamAScore: inn1.runs,
            teamBScore: inn2.runs,
            teamAId: inn1.team_id,
            teamBId: inn2.team_id
        };
    }

    /**
     * Enforce follow-on: Team B bats again (innings 3) instead of Team A.
     * Normal order: A -> B -> A -> B
     * Follow-on:    A -> B -> B -> A
     */
    static async enforceFollowOn(fixtureId) {
        const followOnCheck = await this.checkFollowOn(fixtureId);
        if (!followOnCheck.canEnforceFollowOn) {
            throw new Error(`Cannot enforce follow-on. Deficit (${followOnCheck.deficit}) is less than margin (${followOnCheck.margin}).`);
        }

        // Update fixture
        const { error: updateErr } = await supabase.from('fixtures')
            .update({
                is_follow_on_enforced: true,
                innings_order: JSON.stringify([
                    followOnCheck.teamAId,
                    followOnCheck.teamBId,
                    followOnCheck.teamBId,  // Follow-on: B bats again
                    followOnCheck.teamAId   // A bats last
                ])
            })
            .eq('id', fixtureId);

        if (updateErr) throw new Error(updateErr.message);

        // Create innings 3 for Team B (the follow-on team)
        const { error: insertErr } = await supabase.from('match_scores')
            .insert({
                fixture_id: fixtureId,
                team_id: followOnCheck.teamBId,
                innings: 3
            });

        if (insertErr) throw new Error(insertErr.message);

        return { success: true, followOnTeam: followOnCheck.teamBId };
    }

    /**
     * Decline follow-on: normal innings order continues.
     * Creates innings 3 for Team A.
     */
    static async declineFollowOn(fixtureId) {
        const { data: fixture } = await supabase.from('fixtures')
            .select('*').eq('id', fixtureId).single();
        if (!fixture) throw new Error("Fixture not found");

        const { data: scores } = await supabase.from('match_scores')
            .select('*').eq('fixture_id', fixtureId).order('innings', { ascending: true });

        const inn1 = scores?.find(s => s.innings === 1);
        if (!inn1) throw new Error("Innings 1 not found");

        // Normal order: Team A bats innings 3
        const bowlingTeamId = inn1.team_id; // Team A

        const { error: updateErr } = await supabase.from('fixtures')
            .update({
                is_follow_on_enforced: false,
                innings_order: JSON.stringify([
                    inn1.team_id,
                    scores.find(s => s.innings === 2)?.team_id,
                    inn1.team_id,      // A bats again
                    scores.find(s => s.innings === 2)?.team_id  // B bats last
                ])
            })
            .eq('id', fixtureId);

        if (updateErr) throw new Error(updateErr.message);

        // Create innings 3 for Team A
        const { error: insertErr } = await supabase.from('match_scores')
            .insert({
                fixture_id: fixtureId,
                team_id: bowlingTeamId,
                innings: 3
            });

        if (insertErr) throw new Error(insertErr.message);

        return { success: true, battingTeam: bowlingTeamId };
    }

    /**
     * Declare innings — batting team voluntarily ends their innings.
     */
    static async declareInnings(fixtureId) {
        const { data: fixture } = await supabase.from('fixtures')
            .select('*').eq('id', fixtureId).single();

        if (!fixture) throw new Error("Fixture not found");
        if (fixture.innings_count !== 4) throw new Error("Declaration only applies to test matches");
        if (fixture.status !== 'live') throw new Error("Match is not live");

        // Find the current active innings
        const { data: currentInnings } = await supabase.from('match_scores')
            .select('*')
            .eq('fixture_id', fixtureId)
            .eq('is_completed', false)
            .order('innings', { ascending: false })
            .limit(1)
            .single();

        if (!currentInnings) throw new Error("No active innings to declare");

        // Mark as declared and completed
        const { error: declareErr } = await supabase.from('match_scores')
            .update({ is_declared: true, is_completed: true })
            .eq('id', currentInnings.id);

        if (declareErr) throw new Error(declareErr.message);

        // Determine what happens next
        const completedInnings = currentInnings.innings;

        if (completedInnings >= 4) {
            // Match over
            await supabase.from('fixtures')
                .update({ status: 'completed', match_end_time: new Date().toISOString() })
                .eq('id', fixtureId);
            return { success: true, matchCompleted: true, declaredInnings: completedInnings };
        }

        // Determine next batting team based on innings_order or default order
        const { data: allScores } = await supabase.from('match_scores')
            .select('*').eq('fixture_id', fixtureId).order('innings', { ascending: true });

        let nextBattingTeamId;
        const nextInningsNum = completedInnings + 1;

        if (fixture.innings_order) {
            const order = typeof fixture.innings_order === 'string'
                ? JSON.parse(fixture.innings_order)
                : fixture.innings_order;
            nextBattingTeamId = order[nextInningsNum - 1];
        } else {
            // Default: A -> B -> A -> B
            const inn1Team = allScores.find(s => s.innings === 1)?.team_id;
            const inn2Team = allScores.find(s => s.innings === 2)?.team_id;
            if (nextInningsNum === 2) nextBattingTeamId = inn2Team || (fixture.team_a_id === inn1Team ? fixture.team_b_id : fixture.team_a_id);
            else if (nextInningsNum === 3) nextBattingTeamId = inn1Team;
            else nextBattingTeamId = inn2Team;
        }

        // Check follow-on eligibility after innings 2
        if (completedInnings === 2) {
            const followOnCheck = await this.checkFollowOn(fixtureId).catch(() => null);
            if (followOnCheck && followOnCheck.canEnforceFollowOn) {
                return {
                    success: true,
                    declaredInnings: completedInnings,
                    followOnEligible: true,
                    followOnData: followOnCheck,
                    matchCompleted: false
                };
            }
        }

        // Create next innings
        if (nextBattingTeamId) {
            const { error: nextErr } = await supabase.from('match_scores')
                .insert({
                    fixture_id: fixtureId,
                    team_id: nextBattingTeamId,
                    innings: nextInningsNum
                });
            if (nextErr) throw new Error(nextErr.message);
        }

        return {
            success: true,
            declaredInnings: completedInnings,
            nextInnings: nextInningsNum,
            matchCompleted: false,
            followOnEligible: false
        };
    }

    /**
     * Calculate the result of a test match.
     * Possible results: Win by runs, Win by innings and runs, Win by wickets, Draw, Tie
     */
    static calculateTestResult(scores, fixture) {
        // scores is an object { 1: {...}, 2: {...}, 3: {...}, 4: {...} }
        const inn1 = scores[1];
        const inn2 = scores[2];
        const inn3 = scores[3];
        const inn4 = scores[4];

        if (!inn1 || !inn2) return "Match Incomplete";

        // Determine which team batted in each innings
        const teamAId = fixture.team_a_id;
        const teamBId = fixture.team_b_id;

        const isFollowOn = fixture.is_follow_on_enforced;

        // Calculate total runs per team
        let teamARuns = 0;
        let teamBRuns = 0;

        [inn1, inn2, inn3, inn4].filter(Boolean).forEach(inn => {
            if (inn.team_id === teamAId) teamARuns += inn.runs;
            else if (inn.team_id === teamBId) teamBRuns += inn.runs;
        });

        // Check if all required innings are completed
        const allInningsCompleted = [inn1, inn2, inn3, inn4].filter(Boolean).every(i => i.is_completed);
        const totalCompletedInnings = [inn1, inn2, inn3, inn4].filter(i => i && i.is_completed).length;

        // Check for innings victory (one team didn't need to bat twice)
        if (totalCompletedInnings < 4 && fixture.status === 'completed') {
            // Check if team won by an innings
            if (inn1 && inn2 && inn3 && !inn4) {
                if (teamARuns > teamBRuns) {
                    return { winner: teamAId, margin: teamARuns - teamBRuns, type: 'innings' };
                }
            }
        }

        if (!inn4 && fixture.status !== 'completed') {
            return { type: 'in_progress' };
        }

        if (teamARuns > teamBRuns && allInningsCompleted) {
            return { winner: teamAId, margin: teamARuns - teamBRuns, type: 'runs' };
        } else if (teamBRuns > teamARuns && allInningsCompleted) {
            return { winner: teamBId, margin: teamBRuns - teamARuns, type: 'runs' };
        } else if (teamARuns === teamBRuns && allInningsCompleted) {
            return { type: 'tie' };
        }

        // Draw: not all innings completed and match ended (e.g., overs expired)
        if (fixture.status === 'completed' && !allInningsCompleted) {
            return { type: 'draw' };
        }

        return { type: 'in_progress' };
    }
}

module.exports = TestMatchService;
