const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'hurricane-street-cricket-admin-key';
let activeAdminSession = null;

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    // Explicit Hardcoded Role Requirement
    if (username === 'admin' && password === 'admin@123') {
        const token = jwt.sign({ role: 'admin', time: Date.now() }, JWT_SECRET, { expiresIn: '12h' });
        activeAdminSession = token; // Single Session Enforced Overwrite
        return res.json({ token, role: 'admin' });
    }
    
    return res.status(401).json({ error: 'Invalid admin credentials' });
});

router.post('/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        if (token === activeAdminSession) {
            activeAdminSession = null;
        }
    }
    return res.json({ success: true });
});

router.get('/verify', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ valid: false, error: 'No token provided' });
    
    const token = authHeader.split(' ')[1];
    if (token !== activeAdminSession) {
        return res.status(401).json({ valid: false, error: 'Session overridden by another login' });
    }
    
    try {
        jwt.verify(token, JWT_SECRET);
        return res.json({ valid: true });
    } catch (err) {
        return res.status(401).json({ valid: false, error: 'Token expired or invalid' });
    }
});

const getActiveSession = () => activeAdminSession;

module.exports = { router, getActiveSession, JWT_SECRET };
