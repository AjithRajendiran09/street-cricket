const supabase = require('../db/supabase');

class KnockoutService {
    /**
     * Generate a single-elimination bracket for a knockout tournament.
     * Handles byes when team count is not a power of 2.
     */
    static async generateBracket(tournament_id, overs = 2) {
        if (!tournament_id) throw new Error("Tournament ID is required");

        // Verify no bracket exists yet
        const { data: existing } = await supabase.from('fixtures')
            .select('id').eq('tournament_id', tournament_id);
        if (existing && existing.length > 0) throw new Error("Bracket already generated for this tournament");

        // Fetch teams
        const { data: teams, error } = await supabase.from('teams')
            .select('id, team_name').eq('tournament_id', tournament_id);
        if (error) throw new Error("Error fetching teams");
        if (!teams || teams.length < 2) throw new Error("Need at least 2 teams for a knockout");

        const N = teams.length;
        // Next power of 2
        const bracketSize = Math.pow(2, Math.ceil(Math.log2(N)));
        const totalRounds = Math.log2(bracketSize);
        const byeCount = bracketSize - N;

        // Ensure TBD teams exist for placeholders
        const ensureTbdTeam = async (name) => {
            let { data: tbdTeam } = await supabase.from('teams')
                .select('id').eq('tournament_id', tournament_id).eq('team_name', name).single();
            if (!tbdTeam) {
                const { data: newTbd, error } = await supabase.from('teams').insert({
                    team_name: name,
                    player1_name: 'TBD',
                    player2_name: 'TBD',
                    players: ['TBD'],
                    tournament_id
                }).select('id').single();
                if (error) throw new Error("Failed to create TBD team: " + error.message);
                tbdTeam = newTbd;
            }
            return tbdTeam.id;
        };
        const tbdIdA = await ensureTbdTeam('TBD A');
        const tbdIdB = await ensureTbdTeam('TBD B');

        // Shuffle teams randomly for seeding
        const shuffled = [...teams].sort(() => Math.random() - 0.5);

        // Assign byes: first `byeCount` teams in the shuffled order get byes
        const byeTeams = shuffled.slice(0, byeCount);
        const playingTeams = shuffled.slice(byeCount);

        // Generate round names
        const getRoundName = (round, totalRounds) => {
            const remaining = totalRounds - round;
            if (remaining === 0) return 'Final';
            if (remaining === 1) return 'Semifinal';
            if (remaining === 2) return 'Quarterfinal';
            return `Round ${round + 1}`;
        };

        // Build bracket fixtures bottom-up
        // First round: pair up playing teams
        const allFixtures = []; // { round, position, team_a_id, team_b_id, bracket_round, is_bye }
        const bracketMap = {}; // round -> position -> fixture data

        // Round 1 (first round of actual matches)
        const firstRoundMatchCount = bracketSize / 2;
        let playingIdx = 0;
        let byeIdx = 0;

        for (let pos = 0; pos < firstRoundMatchCount; pos++) {
            // If both slots would be playing teams
            if (playingIdx + 1 < playingTeams.length && byeIdx >= byeCount) {
                // Normal match
                allFixtures.push({
                    round: 0, position: pos,
                    team_a_id: playingTeams[playingIdx].id,
                    team_b_id: playingTeams[playingIdx + 1].id,
                    bracket_round: getRoundName(0, totalRounds),
                    is_bye: false
                });
                playingIdx += 2;
            } else if (byeIdx < byeCount && playingIdx < playingTeams.length) {
                // Bye match — bye team auto-advances, playing team plays
                // We don't create a fixture for a bye, we just note who advances
                allFixtures.push({
                    round: 0, position: pos,
                    team_a_id: byeTeams[byeIdx].id,
                    team_b_id: null, // BYE
                    bracket_round: getRoundName(0, totalRounds),
                    is_bye: true,
                    bye_winner: byeTeams[byeIdx].id
                });
                byeIdx++;
            } else if (playingIdx + 1 < playingTeams.length) {
                allFixtures.push({
                    round: 0, position: pos,
                    team_a_id: playingTeams[playingIdx].id,
                    team_b_id: playingTeams[playingIdx + 1].id,
                    bracket_round: getRoundName(0, totalRounds),
                    is_bye: false
                });
                playingIdx += 2;
            } else if (playingIdx < playingTeams.length) {
                // Odd one out — auto-bye
                allFixtures.push({
                    round: 0, position: pos,
                    team_a_id: playingTeams[playingIdx].id,
                    team_b_id: null,
                    bracket_round: getRoundName(0, totalRounds),
                    is_bye: true,
                    bye_winner: playingTeams[playingIdx].id
                });
                playingIdx++;
            }
        }

        // Create subsequent round placeholders
        for (let round = 1; round < totalRounds; round++) {
            const matchesInRound = bracketSize / Math.pow(2, round + 1);
            for (let pos = 0; pos < matchesInRound; pos++) {
                allFixtures.push({
                    round, position: pos,
                    team_a_id: null,
                    team_b_id: null,
                    bracket_round: getRoundName(round, totalRounds),
                    is_bye: false
                });
            }
        }

        // Insert all fixtures and link them
        // First insert non-bye round 1 matches, then later rounds
        const insertedByRound = {};

        for (let round = totalRounds - 1; round >= 0; round--) {
            const roundFixtures = allFixtures.filter(f => f.round === round);
            insertedByRound[round] = [];

            for (const fix of roundFixtures) {
                if (fix.is_bye) {
                    // Don't insert a fixture for byes, just track the winner
                    insertedByRound[round].push({
                        ...fix,
                        id: null, // No DB record
                        bye_winner: fix.bye_winner
                    });
                    continue;
                }

                // Determine next_fixture_id
                let next_fixture_id = null;
                if (round < totalRounds - 1) {
                    const nextRoundPos = Math.floor(fix.position / 2);
                    const nextFixtures = insertedByRound[round + 1];
                    if (nextFixtures && nextFixtures[nextRoundPos]) {
                        next_fixture_id = nextFixtures[nextRoundPos].id || null;
                    }
                }

                const insertData = {
                    team_a_id: fix.team_a_id,
                    team_b_id: fix.team_b_id,
                    total_overs: overs,
                    status: (fix.team_a_id && fix.team_b_id) ? 'upcoming' : 'upcoming',
                    tournament_id,
                    match_type: fix.bracket_round,
                    bracket_round: `${fix.bracket_round}-${fix.position + 1}`,
                    bracket_position: fix.position,
                    next_fixture_id,
                    innings_count: 2
                };

                // If teams aren't known yet (later rounds), set status as upcoming (TBD)
                if (!fix.team_a_id) insertData.team_a_id = tbdIdA;
                if (!fix.team_b_id) insertData.team_b_id = tbdIdB;

                const { data: inserted, error: insertErr } = await supabase
                    .from('fixtures')
                    .insert(insertData)
                    .select()
                    .single();

                if (insertErr) throw new Error("Failed to insert bracket fixture: " + insertErr.message);
                insertedByRound[round].push({ ...fix, id: inserted.id });
            }
        }

        // Now auto-advance bye winners to next round fixtures
        for (let round = 0; round < totalRounds; round++) {
            const roundEntries = insertedByRound[round] || [];
            for (const entry of roundEntries) {
                if (entry.is_bye && entry.bye_winner) {
                    // Find next round fixture
                    const nextRoundPos = Math.floor(entry.position / 2);
                    const nextRoundEntries = insertedByRound[round + 1];
                    if (nextRoundEntries && nextRoundEntries[nextRoundPos] && nextRoundEntries[nextRoundPos].id) {
                        // Determine if this bye winner goes to team_a or team_b slot
                        const isFirstSlot = entry.position % 2 === 0;
                        const updateField = isFirstSlot ? 'team_a_id' : 'team_b_id';
                        await supabase.from('fixtures')
                            .update({ [updateField]: entry.bye_winner })
                            .eq('id', nextRoundEntries[nextRoundPos].id);
                    }
                }
            }
        }

        // Fetch all created fixtures
        const { data: result } = await supabase.from('fixtures')
            .select('*, team_a:teams!team_a_id(*), team_b:teams!team_b_id(*)')
            .eq('tournament_id', tournament_id)
            .order('created_at', { ascending: true });

        return result || [];
    }

    /**
     * Advance the winner of a completed knockout match to the next bracket slot.
     */
    static async advanceWinner(fixtureId) {
        const { data: fixture } = await supabase.from('fixtures')
            .select('*').eq('id', fixtureId).single();

        if (!fixture || fixture.status !== 'completed') return null;
        if (!fixture.next_fixture_id) return null; // This was the Final

        // Determine the winner
        const { data: innings } = await supabase.from('match_scores')
            .select('*').eq('fixture_id', fixtureId).order('innings', { ascending: true });

        if (!innings || innings.length < 2) return null;

        const inn1 = innings[0];
        const inn2 = innings[1];
        const winnerId = inn2.runs > inn1.runs ? inn2.team_id : inn1.team_id;

        // Get next fixture to determine which slot to fill
        const { data: nextFixture } = await supabase.from('fixtures')
            .select('*').eq('id', fixture.next_fixture_id).single();

        if (!nextFixture) return null;

        // Determine slot: based on bracket_position parity
        const isFirstSlot = (fixture.bracket_position || 0) % 2 === 0;
        const updateField = isFirstSlot ? 'team_a_id' : 'team_b_id';

        await supabase.from('fixtures')
            .update({ [updateField]: winnerId })
            .eq('id', fixture.next_fixture_id);

        return { winnerId, nextFixtureId: fixture.next_fixture_id, slot: updateField };
    }

    /**
     * Get the full bracket structure for visualization.
     */
    static async getBracket(tournament_id) {
        const { data: fixtures, error } = await supabase.from('fixtures')
            .select('*, team_a:teams!team_a_id(*), team_b:teams!team_b_id(*), match_scores(*)')
            .eq('tournament_id', tournament_id)
            .order('created_at', { ascending: true });

        if (error) throw new Error(error.message);

        // Group by bracket_round
        const bracket = {};
        (fixtures || []).forEach(f => {
            const round = f.bracket_round || f.match_type || 'Unknown';
            if (!bracket[round]) bracket[round] = [];
            bracket[round].push(f);
        });

        return { fixtures: fixtures || [], bracket };
    }
}

module.exports = KnockoutService;
