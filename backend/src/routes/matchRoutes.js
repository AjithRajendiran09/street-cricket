const express = require('express');
const MatchService = require('../services/matchService');

const router = express.Router();

// Toss
router.post('/toss/:id', async (req, res) => {
    try {
        const { tossWinnerId, tossDecision } = req.body;
        const fixture = await MatchService.doToss(req.params.id, tossWinnerId, tossDecision);
        res.json(fixture);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Start Match
router.post('/start/:id', async (req, res) => {
    try {
        const fixture = await MatchService.startMatch(req.params.id);
        res.json(fixture);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Add Ball
router.post('/ball/:id', async (req, res) => {
    try {
        const payload = req.body; // runs_scored, is_wide, is_no_ball, is_wicket, wicket_type
        const result = await MatchService.addBall(req.params.id, payload);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Undo Last Ball
router.post('/undo/:id', async (req, res) => {
    try {
        const result = await MatchService.undoLastBall(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
