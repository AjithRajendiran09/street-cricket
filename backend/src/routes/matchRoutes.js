const express = require('express');
const MatchService = require('../services/matchService');
const TestMatchService = require('../services/testMatchService');
const PredictionService = require('../services/predictionService');
const { isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// Toss
router.post('/toss/:id', isAdmin, async (req, res) => {
    try {
        const { tossWinnerId, tossDecision } = req.body;
        const fixture = await MatchService.doToss(req.params.id, tossWinnerId, tossDecision);
        res.json(fixture);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Start Match
router.post('/start/:id', isAdmin, async (req, res) => {
    try {
        const fixture = await MatchService.startMatch(req.params.id);
        res.json(fixture);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Add Ball
router.post('/ball/:id', isAdmin, async (req, res) => {
    try {
        const payload = req.body; // runs_scored, is_wide, is_no_ball, is_wicket, wicket_type
        const result = await MatchService.addBall(req.params.id, payload);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Undo Last Ball
router.post('/undo/:id', isAdmin, async (req, res) => {
    try {
        const result = await MatchService.undoLastBall(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Declare Innings (Test Match only)
router.post('/declare/:id', isAdmin, async (req, res) => {
    try {
        const result = await TestMatchService.declareInnings(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Check Follow-On eligibility (Test Match only)
router.get('/follow-on-check/:id', async (req, res) => {
    try {
        const result = await TestMatchService.checkFollowOn(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Enforce Follow-On (Test Match only)
router.post('/enforce-follow-on/:id', isAdmin, async (req, res) => {
    try {
        const result = await TestMatchService.enforceFollowOn(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Decline Follow-On (Test Match only)
router.post('/decline-follow-on/:id', isAdmin, async (req, res) => {
    try {
        const result = await TestMatchService.declineFollowOn(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// AI Match Prediction
router.get('/predict/:id', async (req, res) => {
    try {
        const prediction = await PredictionService.predictMatch(req.params.id);
        res.json(prediction);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
