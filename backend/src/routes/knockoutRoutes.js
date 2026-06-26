const express = require('express');
const KnockoutService = require('../services/knockoutService');
const { isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// Generate knockout bracket
router.post('/generate-bracket', isAdmin, async (req, res) => {
    try {
        const { tournament_id, overs } = req.body;
        const bracket = await KnockoutService.generateBracket(tournament_id, overs || 2);
        res.status(201).json(bracket);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get bracket structure for visualization
router.get('/bracket/:tournament_id', async (req, res) => {
    try {
        const result = await KnockoutService.getBracket(req.params.tournament_id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
