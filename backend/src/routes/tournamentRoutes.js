const express = require('express');
const TournamentService = require('../services/tournamentService');
const supabase = require('../db/supabase');

const router = express.Router();

router.post('/generate-league', async (req, res) => {
    try {
        const { defaultOvers, tournament_id } = req.body;
        const fixtures = await TournamentService.generateLeagueFixtures(defaultOvers || 2, tournament_id);
        res.status(201).json(fixtures);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/generate-playoffs', async (req, res) => {
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

router.post('/create', async (req, res) => {
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

router.delete('/:id', async (req, res) => {
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
