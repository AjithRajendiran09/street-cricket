const express = require('express');
const supabase = require('../db/supabase');
const { isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * Validate player array based on tournament format.
 * League/Knockout: 2-3 players, Test: 2-11 players
 */
const validatePlayers = (players, format) => {
    if (!Array.isArray(players) || players.length === 0) {
        throw new Error("Players array is required");
    }

    const trimmed = players.map(p => p.trim()).filter(p => p.length > 0);
    
    if (format === 'test') {
        if (trimmed.length < 2) throw new Error("Test match teams need at least 2 players");
        if (trimmed.length > 11) throw new Error("Maximum 11 players allowed per team");
    } else {
        if (trimmed.length < 2) throw new Error("Teams need at least 2 players");
        if (trimmed.length > 3) throw new Error("League/Knockout teams can have up to 3 players");
    }

    // Check for duplicates
    const lower = trimmed.map(p => p.toLowerCase());
    const unique = new Set(lower);
    if (unique.size !== lower.length) {
        throw new Error("All player names within a team must be unique.");
    }

    return trimmed;
};

router.post('/', isAdmin, async (req, res) => {
    try {
        const { team_name, players, player1_name, player2_name, player3_name, tournament_id } = req.body;
        
        if (!team_name || !tournament_id) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Get tournament format
        const { data: tournament } = await supabase.from('tournaments')
            .select('format').eq('id', tournament_id).single();
        const format = tournament?.format || 'league';

        // Support both new (players array) and legacy (player1/2/3) formats
        let playersArray;
        if (players && Array.isArray(players)) {
            playersArray = validatePlayers(players, format);
        } else if (player1_name && player2_name) {
            // Legacy format — convert to array
            const legacyPlayers = [player1_name, player2_name];
            if (player3_name && player3_name.trim()) legacyPlayers.push(player3_name);
            playersArray = validatePlayers(legacyPlayers, format);
        } else {
            return res.status(400).json({ error: "Players are required" });
        }

        // Insert with both JSONB and legacy columns for backward compatibility
        const insertData = {
            team_name,
            tournament_id,
            players: playersArray,
            player1_name: playersArray[0] || null,
            player2_name: playersArray[1] || null,
            player3_name: playersArray[2] || null
        };

        const { data, error } = await supabase
            .from('teams')
            .insert(insertData)
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
        const { team_name, players, player1_name, player2_name, player3_name, tournament_id } = req.body;
        
        if (!team_name || !tournament_id) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Get tournament format
        const { data: tournament } = await supabase.from('tournaments')
            .select('format').eq('id', tournament_id).single();
        const format = tournament?.format || 'league';

        let playersArray;
        if (players && Array.isArray(players)) {
            playersArray = validatePlayers(players, format);
        } else if (player1_name && player2_name) {
            const legacyPlayers = [player1_name, player2_name];
            if (player3_name && player3_name.trim()) legacyPlayers.push(player3_name);
            playersArray = validatePlayers(legacyPlayers, format);
        } else {
            return res.status(400).json({ error: "Players are required" });
        }

        const updateData = {
            team_name,
            players: playersArray,
            player1_name: playersArray[0] || null,
            player2_name: playersArray[1] || null,
            player3_name: playersArray[2] || null
        };

        const { data, error } = await supabase
            .from('teams')
            .update(updateData)
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
        
        // Filter out placeholder TBD teams
        const filteredTeams = data.filter(t => !t.team_name.startsWith('TBD'));
        res.json(filteredTeams);
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
