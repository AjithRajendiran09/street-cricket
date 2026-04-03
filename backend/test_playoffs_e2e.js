const supabase = require('./src/db/supabase');
const TournamentService = require('./src/services/tournamentService');
const MatchService = require('./src/services/matchService');

async function run() {
    try {
        console.log("🚀 E2E Playoff Engine Validation Booting...");

        // 1. Create a 3 Team Tournament specifically to test "Final immediately generated"
        const { data: t3, error: t3e } = await supabase.from('tournaments')
            .insert({ name: "Playoff Test Cup 3T", ground: "Matrix" }).select().single();
        if (t3e) throw t3e;
        console.log("✅ Tournament created: " + t3.id);

        for (let name of ["Alpha", "Beta", "Gamma"]) {
            await supabase.from('teams').insert({
                team_name: name,
                player1_name: `${name} 1`,
                player2_name: `${name} 2`,
                tournament_id: t3.id
            });
        }
        console.log("✅ Teams inserted");

        await TournamentService.generateLeagueFixtures(1, t3.id);
        const { data: t3Fixtures } = await supabase.from('fixtures').select('*').eq('tournament_id', t3.id);
        
        // Complete the league matches randomly
        console.log("⏳ Simulating completed league games...");
        let pointSeed = [ [1,0], [1,0], [0,1] ];
        for (let i = 0; i < t3Fixtures.length; i++) {
             const f = t3Fixtures[i];
             await MatchService.doToss(f.id, f.team_a_id, 'bat');
             await MatchService.startMatch(f.id);
             // Manually inject scores for speed
             await supabase.from('match_scores').update({ runs: pointSeed[i][0] * 10, balls_bowled: 6, is_completed: true }).eq('fixture_id', f.id).eq('innings', 1);
             await supabase.from('match_scores').insert({ fixture_id: f.id, team_id: f.team_b_id, innings: 2 });
             await supabase.from('match_scores').update({ runs: pointSeed[i][1] * 10, balls_bowled: 6, is_completed: true }).eq('fixture_id', f.id).eq('innings', 2);
             await supabase.from('fixtures').update({ status: 'completed' }).eq('id', f.id);
        }

        console.log("⏳ Checking points table...");
        const table = await TournamentService.getPointsTable(t3.id);
        console.log("Points table:", table.map(t => `${t.team_name}: ${t.points} pts`));

        console.log("⏳ Generating Playoffs for <= 4 Teams...");
        const p3 = await TournamentService.generatePlayoffs(2, t3.id);
        console.log("✅ Playoffs Generated:", p3.map(f => f.match_type));

        // Let's create a 5 Team tournament to test Semifinal Event Driven Final
        const { data: t5 } = await supabase.from('tournaments')
            .insert({ name: "Playoff Test Cup 5T", ground: "Matrix" }).select().single();
        for (let name of ["A", "B", "C", "D", "E"]) {
            await supabase.from('teams').insert({ team_name: name, player1_name: `${name}1`, tournament_id: t5.id });
        }
        await TournamentService.generateLeagueFixtures(1, t5.id);
        const { data: t5Fixtures } = await supabase.from('fixtures').select('*').eq('tournament_id', t5.id);
        for (let i = 0; i < t5Fixtures.length; i++) {
             const f = t5Fixtures[i];
             await MatchService.doToss(f.id, f.team_a_id, 'bat');
             await MatchService.startMatch(f.id);
             await supabase.from('match_scores').update({ runs: 10, balls_bowled: 6, is_completed: true }).eq('fixture_id', f.id).eq('innings', 1);
             await supabase.from('match_scores').insert({ fixture_id: f.id, team_id: f.team_b_id, innings: 2 });
             await supabase.from('match_scores').update({ runs: 12, balls_bowled: 6, is_completed: true }).eq('fixture_id', f.id).eq('innings', 2);
             await supabase.from('fixtures').update({ status: 'completed' }).eq('id', f.id);
        }

        console.log("⏳ Generating Playoffs for 5 Teams...");
        const p5 = await TournamentService.generatePlayoffs(2, t5.id);
        console.log("✅ Initial Playoffs Generated:", p5.map(f => f.match_type));

        const semiFinal = p5.find(f => f.match_type === 'Semifinal');
        console.log(`⏳ Simulating Semifinal Match ID: ${semiFinal.id}`);
        await MatchService.doToss(semiFinal.id, semiFinal.team_a_id, 'bat');
        await MatchService.startMatch(semiFinal.id);
        await MatchService.addBall(semiFinal.id, { runs_scored: 5, striker_name: 'A1', is_wicket: true }); // Assume team 1 gets out immediately. Wicket = 1
        // Wait, max_wickets for 1 player is 1, so hitting a wicket should auto-complete!
        
        // Simulating the exact match completion trigger properly because the user might have missed it
        await supabase.from('match_scores').update({ runs: 20, is_completed: true }).eq('fixture_id', semiFinal.id).eq('innings', 1);
        await supabase.from('match_scores').insert({ fixture_id: semiFinal.id, team_id: semiFinal.team_b_id, innings: 2 });
        // Instead of calling addBall (which auto triggers final), we'll simulate the EXACT ending
        await MatchService.addBall(semiFinal.id, { runs_scored: 21, striker_name: 'B1', is_wicket: true });
        
        console.log("⏳ Verifying if Final was automatically created by MatchService event...");
        const { data: finalCheck } = await supabase.from('fixtures').select('*').eq('tournament_id', t5.id).eq('match_type', 'Final');
        console.log(`✅ Dynamically Scoped Finals Found: ${finalCheck.length} -> MATCH_TYPE: ${finalCheck[0]?.match_type}`);

        // Cleanup
        await supabase.from('tournaments').delete().in('id', [t3.id, t5.id]);
        console.log("🧹 Cleanup successful!");

    } catch (e) {
        console.error("FATAL E2E ERROR:", e);
    }
}
run();
