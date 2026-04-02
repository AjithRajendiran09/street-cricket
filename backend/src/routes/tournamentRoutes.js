const express = require('express');
const TournamentService = require('../services/tournamentService');
const supabase = require('../db/supabase');
const { isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/generate-league', isAdmin, async (req, res) => {
    try {
        const { defaultOvers, tournament_id } = req.body;
        const fixtures = await TournamentService.generateLeagueFixtures(defaultOvers || 2, tournament_id);
        res.status(201).json(fixtures);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/generate-playoffs', isAdmin, async (req, res) => {
    try {
        const { playoffOvers, tournament_id } = req.body;
        const fixtures = await TournamentService.generatePlayoffs(playoffOvers || 3, tournament_id);
        res.status(201).json(fixtures);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/points-table', async (req, res) => {
    try {
        const { tournament_id } = req.query;
        if (!tournament_id) return res.json([]);
        const table = await TournamentService.getPointsTable(tournament_id);
        res.json(table);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/fixtures', async (req, res) => {
    try {
        const { tournament_id } = req.query;
        if (!tournament_id) return res.json([]);
        const { data, error } = await supabase
            .from('fixtures')
            .select('*, team_a:teams!team_a_id(*), team_b:teams!team_b_id(*)')
            .eq('tournament_id', tournament_id)
            .order('created_at', { ascending: true });
            
        if (error) throw new Error(error.message);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/fixtures/:id', async (req, res) => {
    try {
        const { data: fixture, error } = await supabase
            .from('fixtures')
            .select('*, team_a:teams!team_a_id(*), team_b:teams!team_b_id(*), match_scores(*), ball_by_ball(*)')
            .eq('id', req.params.id)
            .single();
            
        if (error) throw new Error(error.message);
        res.json(fixture);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/player-stats', async (req, res) => {
    try {
        const { tournament_id } = req.query;
        if (!tournament_id) return res.status(400).json({ error: "tournament_id is required" });

        const { data: fixtures } = await supabase.from('fixtures').select('id').eq('tournament_id', tournament_id);
        if (!fixtures || fixtures.length === 0) return res.json({ orangeCap: [], purpleCap: [] });

        const fixtureIds = fixtures.map(f => f.id);
        
        // Batch fetch all historical balls recursively for these matches
        const { data: balls, error: bErr } = await supabase.from('ball_by_ball').select('*').in('fixture_id', fixtureIds);
        if (bErr) throw new Error(bErr.message);

        const batters = {};
        const bowlers = {};

        balls.forEach(b => {
             // Core Batting Analytics Generator
             if (b.striker_name && b.striker_name.trim() !== '') {
                 if (!batters[b.striker_name]) batters[b.striker_name] = { name: b.striker_name, runs: 0, balls: 0, fours: 0, sixes: 0 };
                 if (!b.is_wide) {
                     batters[b.striker_name].balls += 1;
                     batters[b.striker_name].runs += (b.runs_scored || 0);
                     if (b.runs_scored === 4) batters[b.striker_name].fours += 1;
                     if (b.runs_scored === 6) batters[b.striker_name].sixes += 1;
                 }
             }

             // Core Bowling Analytics Generator
             if (b.bowler_name && b.bowler_name.trim() !== '') {
                 if (!bowlers[b.bowler_name]) bowlers[b.bowler_name] = { name: b.bowler_name, wickets: 0, balls: 0, runs_conceded: 0, dots: 0 };
                 bowlers[b.bowler_name].runs_conceded += (b.runs_scored || 0) + (b.extras || 0);

                 if (!b.is_wide && !b.is_no_ball) {
                     bowlers[b.bowler_name].balls += 1;
                 }
                 if (b.is_wicket && b.wicket_type !== 'run_out') { 
                     bowlers[b.bowler_name].wickets += 1;
                 }
                 if ((b.runs_scored || 0) === 0 && !b.is_wide && !b.is_no_ball && (b.extras || 0) === 0 && !b.is_wicket) {
                     bowlers[b.bowler_name].dots += 1;
                 }
             }
        });

        // Resolve, Sort, and Clean memory objects
        const orangeCap = Object.values(batters)
            .map(b => ({ ...b, strike_rate: b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(2) : "0.00" }))
            .sort((a,b) => b.runs - a.runs || b.strike_rate - a.strike_rate)
            .slice(0, 20);

        const purpleCap = Object.values(bowlers)
            .map(b => {
                const overs = b.balls / 6;
                const econ = overs > 0 ? (b.runs_conceded / overs).toFixed(2) : "0.00";
                return { ...b, overs: Math.floor(b.balls/6) + "." + (b.balls%6), economy: econ };
            })
            .sort((a,b) => b.wickets - a.wickets || a.economy - b.economy)
            .slice(0, 20);

        res.json({ orangeCap, purpleCap });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/create', isAdmin, async (req, res) => {
    try {
        const { name, ground } = req.body;
        const { data, error } = await supabase
            .from('tournaments')
            .insert({ name, ground })
            .select()
            .single();
        if (error) throw new Error(error.message);
        res.json(data);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/list', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tournaments')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw new Error(error.message);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/leaderboard', async (req, res) => {
    try {
        const { tournament_id } = req.query;
        let query = supabase.from('ball_by_ball').select('*, fixtures!inner(id, tournament_id)');
        
        if (tournament_id && tournament_id !== 'overall') {
            query = query.eq('fixtures.tournament_id', tournament_id);
        }
        
        const { data: balls, error } = await query;
        if (error) throw new Error(error.message);

        const battingStats = {};
        const bowlingStats = {};

        balls.forEach(b => {
            if (b.striker_name) {
                if (!battingStats[b.striker_name]) battingStats[b.striker_name] = { name: b.striker_name, runs: 0, balls: 0, sixes: 0, fours: 0 };
                const stat = battingStats[b.striker_name];
                if (!b.is_wide) stat.balls += 1;
                stat.runs += b.runs_scored;
                if (b.runs_scored === 4) stat.fours += 1;
                if (b.runs_scored === 6) stat.sixes += 1;
            }

            if (b.bowler_name) {
                if (!bowlingStats[b.bowler_name]) bowlingStats[b.bowler_name] = { name: b.bowler_name, runs_conceded: 0, wickets: 0, balls_bowled: 0, extras: 0 };
                const stat = bowlingStats[b.bowler_name];
                if (!b.is_wide && !b.is_no_ball) stat.balls_bowled += 1;
                stat.runs_conceded += (b.runs_scored + b.extras);
                stat.extras += b.extras;
                if (b.is_wicket && !['run_out', 'retired_hurt'].includes(b.wicket_type)) {
                    stat.wickets += 1;
                }
            }
        });

        res.json({
            batsmen: Object.values(battingStats).sort((a,b) => b.runs - a.runs).slice(0, 15),
            bowlers: Object.values(bowlingStats).sort((a,b) => b.wickets - a.wickets || a.runs_conceded - b.runs_conceded).slice(0, 15)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', isAdmin, async (req, res) => {
    try {
        const tournamentId = req.params.id;

        const { data: fixtures } = await supabase.from('fixtures').select('id').eq('tournament_id', tournamentId);
        if (fixtures && fixtures.length > 0) {
            const fixtureIds = fixtures.map(f => f.id);
            await supabase.from('ball_by_ball').delete().in('fixture_id', fixtureIds);
            await supabase.from('match_scores').delete().in('fixture_id', fixtureIds);
            await supabase.from('fixtures').delete().eq('tournament_id', tournamentId);
        }

        await supabase.from('teams').delete().eq('tournament_id', tournamentId);
        
        const { error } = await supabase.from('tournaments').delete().eq('id', tournamentId);
        if (error) throw new Error(error.message);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
