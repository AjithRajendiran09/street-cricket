const express = require('express');
const supabase = require('../db/supabase');
const { isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', isAdmin, async (req, res) => {
    try {
        const { team_name, player1_name, player2_name, player3_name, tournament_id } = req.body;
        
        if (!team_name || !player1_name || !player2_name || !tournament_id) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const p1 = player1_name.trim().toLowerCase();
        const p2 = player2_name.trim().toLowerCase();
        const p3 = player3_name ? player3_name.trim().toLowerCase() : null;

        if (p1 === p2 || (p3 && (p1 === p3 || p2 === p3))) {
            return res.status(400).json({ error: "All player names within a team must be unique." });
        }

        const { data, error } = await supabase
            .from('teams')
            .insert({ team_name, player1_name, player2_name, player3_name, tournament_id })
            .select()
            .single();

        if (error) throw new Error(error.message);
        res.status(201).json(data);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/:id', isAdmin, async (req, res) => {
    try {
        const { team_name, player1_name, player2_name, player3_name, tournament_id } = req.body;
        
        if (!team_name || !player1_name || !player2_name || !tournament_id) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const p1 = player1_name.trim().toLowerCase();
        const p2 = player2_name.trim().toLowerCase();
        const p3 = player3_name ? player3_name.trim().toLowerCase() : null;

        if (p1 === p2 || (p3 && (p1 === p3 || p2 === p3))) {
            return res.status(400).json({ error: "All player names within a team must be unique." });
        }

        const { data, error } = await supabase
            .from('teams')
            .update({ team_name, player1_name, player2_name, player3_name })
            .eq('id', req.params.id)
            .eq('tournament_id', tournament_id)
            .select()
            .single();

        if (error) throw new Error(error.message);
        res.json(data);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const { tournament_id } = req.query;
        if (!tournament_id) return res.json([]);
        const { data, error } = await supabase.from('teams').select('*').eq('tournament_id', tournament_id).order('created_at', { ascending: false });
        if (error) throw new Error(error.message);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', isAdmin, async (req, res) => {
    try {
        const { error } = await supabase
            .from('teams')
            .delete()
            .eq('id', req.params.id);

        if (error) throw new Error(error.message);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
