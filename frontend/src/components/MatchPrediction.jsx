import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

/**
 * AI Match Prediction Card
 * 
 * Displays pre-match predictions based on historical team statistics.
 * Uses the backend prediction engine (multi-factor weighted model).
 * 
 * Props:
 *   - fixtureId: UUID of the fixture to predict
 *   - compact: boolean (default false) — if true, shows minimal view for fixture cards
 */
export default function MatchPrediction({ fixtureId, compact = false }) {
    const [prediction, setPrediction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!fixtureId) return;
        
        fetch(`${API_BASE}/matches/predict/${fixtureId}`)
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    setError(true);
                } else {
                    setPrediction(data);
                }
                setLoading(false);
            })
            .catch(() => {
                setError(true);
                setLoading(false);
            });
    }, [fixtureId]);

    if (loading) {
        return (
            <div className={`flex items-center justify-center gap-2 ${compact ? 'py-2' : 'py-6'}`}>
                <div className="w-3 h-3 bg-purple-500 rounded-full animate-ping"></div>
                <span className="text-gray-500 text-xs uppercase tracking-widest font-bold animate-pulse">
                    AI Analyzing...
                </span>
            </div>
        );
    }

    if (error || !prediction) return null;

    const { team_a, team_b, head_to_head, insights } = prediction;
    const favTeam = team_a.probability >= team_b.probability ? team_a : team_b;
    const underdogTeam = team_a.probability < team_b.probability ? team_a : team_b;

    // Compact mode: just a probability bar for fixture cards
    if (compact) {
        return (
            <div className="w-full mt-2">
                <div className="flex justify-between text-[9px] font-black uppercase tracking-widest mb-1">
                    <span className="text-gray-400 truncate flex-1">
                        {team_a.name} <span className="text-purple-400">{team_a.probability}%</span>
                    </span>
                    <span className="text-gray-500 text-[8px] mx-1">🤖 AI</span>
                    <span className="text-gray-400 truncate flex-1 text-right">
                        <span className="text-purple-400">{team_b.probability}%</span> {team_b.name}
                    </span>
                </div>
                <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden flex shadow-inner">
                    <div
                        className="h-full bg-gradient-to-r from-purple-600 to-purple-500 transition-all duration-1000 ease-out"
                        style={{ width: `${team_a.probability}%` }}
                    ></div>
                    <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-cyan-600 transition-all duration-1000 ease-out"
                        style={{ width: `${team_b.probability}%` }}
                    ></div>
                </div>
            </div>
        );
    }

    // Full prediction card
    return (
        <div className="bg-gradient-to-br from-gray-900 via-purple-950/30 to-gray-900 rounded-2xl border border-purple-500/30 overflow-hidden shadow-[0_0_40px_rgba(147,51,234,0.1)] relative">
            {/* Glow effect */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-purple-600 rounded-full blur-[100px] opacity-20 pointer-events-none"></div>

            {/* Header */}
            <div className="bg-black/50 border-b border-purple-500/20 px-5 py-3 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2">
                    <span className="text-purple-400 text-lg">🤖</span>
                    <h3 className="text-purple-400 font-black uppercase tracking-widest text-xs">AI Match Prediction</h3>
                </div>
                <span className="text-[9px] text-gray-600 uppercase tracking-widest font-bold bg-gray-900 px-2 py-1 rounded border border-gray-800">
                    v{prediction.model_version}
                </span>
            </div>

            {/* Probability Section */}
            <div className="p-5 relative z-10">
                {/* Team probabilities */}
                <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1 text-center">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold truncate">{team_a.name}</p>
                        <p className={`text-4xl font-black tabular-nums mt-1 ${
                            team_a.probability >= team_b.probability 
                                ? 'text-purple-400 drop-shadow-[0_0_15px_rgba(147,51,234,0.5)]' 
                                : 'text-gray-500'
                        }`}>
                            {team_a.probability}<span className="text-lg">%</span>
                        </p>
                    </div>
                    <div className="text-gray-700 font-bold text-sm flex flex-col items-center">
                        <span className="text-purple-500/50 text-lg mb-1">⚡</span>
                        <span className="text-[8px] uppercase tracking-widest">vs</span>
                    </div>
                    <div className="flex-1 text-center">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold truncate">{team_b.name}</p>
                        <p className={`text-4xl font-black tabular-nums mt-1 ${
                            team_b.probability >= team_a.probability 
                                ? 'text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]' 
                                : 'text-gray-500'
                        }`}>
                            {team_b.probability}<span className="text-lg">%</span>
                        </p>
                    </div>
                </div>

                {/* Probability Bar */}
                <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden flex shadow-inner mb-4 relative">
                    <div
                        className="h-full bg-gradient-to-r from-purple-700 via-purple-500 to-purple-400 transition-all duration-[1500ms] ease-out relative"
                        style={{ width: `${team_a.probability}%` }}
                    >
                        <div className="absolute inset-0 bg-white/10 animate-pulse"></div>
                    </div>
                    <div className="w-0.5 h-full bg-black z-10"></div>
                    <div
                        className="h-full bg-gradient-to-r from-cyan-400 via-cyan-500 to-cyan-700 transition-all duration-[1500ms] ease-out relative"
                        style={{ width: `${team_b.probability}%` }}
                    >
                        <div className="absolute inset-0 bg-white/10 animate-pulse"></div>
                    </div>
                </div>

                {/* H2H Quick Stat */}
                {head_to_head.total > 0 && (
                    <div className="flex justify-center gap-6 text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-4 bg-black/30 py-2 rounded-lg border border-gray-800">
                        <span>H2H: <span className="text-purple-400">{head_to_head.team_a_wins}</span></span>
                        <span className="text-gray-700">-</span>
                        <span><span className="text-cyan-400">{head_to_head.team_b_wins}</span></span>
                        {head_to_head.draws > 0 && <span className="text-gray-600">({head_to_head.draws} draws)</span>}
                    </div>
                )}

                {/* Expand/Collapse for insights */}
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full text-center py-2 text-[10px] text-gray-500 hover:text-purple-400 uppercase tracking-widest font-bold transition flex items-center justify-center gap-1"
                >
                    {expanded ? '▲ Hide' : '▼ View'} AI Insights
                </button>

                {/* Insights Panel */}
                {expanded && (
                    <div className="mt-3 space-y-2 animate-fade-in">
                        {insights.map((insight, i) => (
                            <div
                                key={i}
                                className="bg-black/40 border border-gray-800 rounded-lg px-4 py-3 text-sm text-gray-300 flex items-start gap-2"
                            >
                                <span className="text-lg flex-shrink-0">{insight.charAt(0) === '🔮' || insight.charAt(0) === '📊' || insight.charAt(0) === '🏏' || insight.charAt(0) === '⚾' || insight.charAt(0) === '🤝' || insight.charAt(0) === '🔥' || insight.charAt(0) === '💥' || insight.charAt(0) === '🌟' || insight.charAt(0) === '⚖' ? '' : ''}</span>
                                <span>{insight}</span>
                            </div>
                        ))}

                        {/* Stat Comparison Grid */}
                        <div className="grid grid-cols-3 gap-1 mt-4 text-center text-[10px] uppercase tracking-widest font-bold">
                            <div className="text-purple-400 truncate">{team_a.name}</div>
                            <div className="text-gray-600">Stat</div>
                            <div className="text-cyan-400 truncate">{team_b.name}</div>

                            <StatRow label="Win Rate" a={`${(team_a.stats.win_rate * 100).toFixed(0)}%`} b={`${(team_b.stats.win_rate * 100).toFixed(0)}%`} aVal={team_a.stats.win_rate} bVal={team_b.stats.win_rate} />
                            <StatRow label="Bat RPO" a={team_a.stats.batting_avg_rpo} b={team_b.stats.batting_avg_rpo} aVal={team_a.stats.batting_avg_rpo} bVal={team_b.stats.batting_avg_rpo} />
                            <StatRow label="Bowl Econ" a={team_a.stats.bowling_avg_economy} b={team_b.stats.bowling_avg_economy} aVal={team_b.stats.bowling_avg_economy} bVal={team_a.stats.bowling_avg_economy} invert />
                            <StatRow label="Boundary %" a={`${(team_a.stats.boundary_rate * 100).toFixed(1)}%`} b={`${(team_b.stats.boundary_rate * 100).toFixed(1)}%`} aVal={team_a.stats.boundary_rate} bVal={team_b.stats.boundary_rate} />
                            <StatRow label="Matches" a={team_a.stats.matches_played} b={team_b.stats.matches_played} aVal={team_a.stats.matches_played} bVal={team_b.stats.matches_played} />
                        </div>
                    </div>
                )}
            </div>

            {/* Favorite Team Badge */}
            <div className="bg-black/50 border-t border-purple-500/20 px-5 py-3 flex items-center justify-center gap-2 relative z-10">
                <span className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">Predicted Winner:</span>
                <span className={`text-sm font-black uppercase tracking-wider ${
                    favTeam.id === team_a.id ? 'text-purple-400' : 'text-cyan-400'
                }`}>
                    {favTeam.name}
                </span>
                <span className="text-[10px] text-gray-700 font-bold">
                    ({favTeam.probability}%)
                </span>
            </div>
        </div>
    );
}

/** Small stat comparison row */
function StatRow({ label, a, b, aVal, bVal, invert = false }) {
    // For invert (like economy where lower is better), we flip the highlight logic
    const aWins = invert ? aVal > bVal : aVal > bVal;
    const bWins = invert ? bVal > aVal : bVal > aVal;

    return (
        <>
            <div className={`py-2 px-1 rounded ${aWins ? 'bg-purple-950/40 text-purple-300' : 'text-gray-500'}`}>
                {a}
            </div>
            <div className="py-2 px-1 text-gray-600 flex items-center justify-center">
                {label}
            </div>
            <div className={`py-2 px-1 rounded ${bWins ? 'bg-cyan-950/40 text-cyan-300' : 'text-gray-500'}`}>
                {b}
            </div>
        </>
    );
}
