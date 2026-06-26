const express = require('express');
const cors = require('cors');
require('dotenv').config();

const teamRoutes = require('./src/routes/teamRoutes');
const matchRoutes = require('./src/routes/matchRoutes');
const tournamentRoutes = require('./src/routes/tournamentRoutes');
const knockoutRoutes = require('./src/routes/knockoutRoutes');
const authRoutes = require('./src/routes/authRoutes').router;

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Main Routes
app.use('/api/auth', authRoutes); // Auth controller
app.use('/api/teams', teamRoutes);
app.use('/api/matches', matchRoutes); // Toss, Score Add, Undo, Declare, Follow-On
app.use('/api/tournament', tournamentRoutes); // Fixtures, Points, Playoff
app.use('/api/knockout', knockoutRoutes); // Bracket Generation & Visualization

app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
    console.log(`Street Cricket API running on port ${PORT}`);
});
