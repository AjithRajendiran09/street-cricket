import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export default function KnockoutBracket() {
  const [bracket, setBracket] = useState(null);
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const activeTournamentId = localStorage.getItem('active_tournament');
  const navigate = useNavigate();

  useEffect(() => {
    if (!activeTournamentId) {
      navigate('/');
      return;
    }
    fetchBracket();
  }, [activeTournamentId]);

  const fetchBracket = async () => {
    try {
      const res = await fetch(`${API_BASE}/knockout/bracket/${activeTournamentId}`);
      const data = await res.json();
      setBracket(data.bracket || {});
      setFixtures(data.fixtures || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-white">Loading bracket...</div>;

  // Group fixtures by round type for display
  const roundOrder = ['Quarterfinal', 'Semifinal', 'Final'];
  const rounds = [];
  const usedRounds = new Set();

  // Sort fixtures into rounds
  for (const ro of roundOrder) {
    const roundFixtures = fixtures.filter(f => {
      if (usedRounds.has(f.id)) return false;
      const typeMatch = (f.match_type || '').toLowerCase().includes(ro.toLowerCase());
      const roundMatch = (f.bracket_round || '').toLowerCase().includes(ro.toLowerCase());
      
      // Prevent "Semifinal" from matching "Final" due to string inclusion
      if (ro === 'Final' && (f.match_type?.toLowerCase().includes('semifinal') || f.bracket_round?.toLowerCase().includes('semifinal'))) {
        return false;
      }
      if (ro === 'Final' && (f.match_type?.toLowerCase().includes('quarterfinal') || f.bracket_round?.toLowerCase().includes('quarterfinal'))) {
        return false;
      }

      return typeMatch || roundMatch;
    });
    
    if (roundFixtures.length > 0) {
      rounds.push({ name: ro, fixtures: roundFixtures });
      roundFixtures.forEach(f => usedRounds.add(f.id));
    }
  }

  // Add any remaining rounds not matched
  const remaining = fixtures.filter(f => !usedRounds.has(f.id));
  if (remaining.length > 0) {
    // Group by match_type
    const grouped = {};
    remaining.forEach(f => {
      const key = f.match_type || 'Round';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(f);
    });
    Object.entries(grouped).forEach(([name, fxs]) => {
      rounds.unshift({ name, fixtures: fxs });
    });
  }

  const getStatusStyle = (status) => {
    switch (status) {
      case 'live': return 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]';
      case 'completed': return 'border-green-700';
      case 'toss': return 'border-yellow-600';
      default: return 'border-gray-700';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'live': return <span className="bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase animate-pulse">Live</span>;
      case 'completed': return <span className="bg-green-800 text-green-400 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Done</span>;
      case 'toss': return <span className="bg-yellow-800 text-yellow-400 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Toss</span>;
      default: return <span className="bg-gray-800 text-gray-400 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Upcoming</span>;
    }
  };

  const getMatchScore = (fixture) => {
    if (!fixture.match_scores || fixture.match_scores.length === 0) return null;
    const scores = {};
    fixture.match_scores.forEach(s => { scores[s.team_id] = s; });
    return scores;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-gray-700 pb-2">
        <h1 className="text-3xl font-bold text-orange-400 uppercase">⚔️ Knockout Bracket</h1>
      </div>

      {fixtures.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg uppercase tracking-widest font-bold mb-4">No bracket generated yet</p>
          <p className="text-gray-600 text-sm">Register teams first, then generate the bracket from the Fixtures page.</p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6 overflow-x-auto pb-4">
          {rounds.map((round, roundIdx) => (
            <div key={round.name} className="flex-shrink-0 w-full md:w-72">
              {/* Round Header */}
              <div className="text-center mb-4">
                <h3 className={`text-sm font-black uppercase tracking-widest ${
                  round.name === 'Final' ? 'text-yellow-400' : 'text-gray-400'
                }`}>
                  {round.name === 'Final' ? '🏆 ' : ''}{round.name}
                </h3>
                <div className={`h-0.5 mt-2 rounded-full ${
                  round.name === 'Final' ? 'bg-yellow-500' : 'bg-gray-700'
                }`}></div>
              </div>

              {/* Match Cards */}
              <div className="space-y-4 flex flex-col justify-around min-h-[200px]">
                {round.fixtures.map(f => {
                  const matchScores = getMatchScore(f);
                  const teamAScore = matchScores?.[f.team_a_id];
                  const teamBScore = matchScores?.[f.team_b_id];

                  return (
                    <div
                      key={f.id}
                      className={`bg-cricket-card rounded-xl border ${getStatusStyle(f.status)} overflow-hidden transition-all hover:scale-[1.02]`}
                    >
                      <div className="flex items-center justify-between px-3 py-1.5 bg-black/50 border-b border-gray-800">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                          {f.bracket_round || f.match_type}
                        </span>
                        {getStatusBadge(f.status)}
                      </div>

                      {/* Team A */}
                      <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-800/50 ${
                        f.status === 'completed' && teamAScore && teamBScore && teamAScore.runs > teamBScore.runs ? 'bg-green-900/20' : ''
                      }`}>
                        <span className={`font-bold uppercase text-sm truncate flex-1 ${
                          f.team_a ? 'text-white' : 'text-gray-600 italic'
                        }`}>
                          {f.team_a?.team_name || 'TBD'}
                        </span>
                        {teamAScore && (
                          <span className="text-white font-black text-sm ml-2 tabular-nums">
                            {teamAScore.runs}/{teamAScore.wickets}
                            <span className="text-[10px] text-gray-500 ml-1">({Math.floor(teamAScore.balls_bowled/6)}.{teamAScore.balls_bowled%6})</span>
                          </span>
                        )}
                      </div>

                      {/* Team B */}
                      <div className={`flex items-center justify-between px-4 py-3 ${
                        f.status === 'completed' && teamAScore && teamBScore && teamBScore.runs > teamAScore.runs ? 'bg-green-900/20' : ''
                      }`}>
                        <span className={`font-bold uppercase text-sm truncate flex-1 ${
                          f.team_b ? 'text-white' : 'text-gray-600 italic'
                        }`}>
                          {f.team_b?.team_name || 'TBD'}
                        </span>
                        {teamBScore && (
                          <span className="text-white font-black text-sm ml-2 tabular-nums">
                            {teamBScore.runs}/{teamBScore.wickets}
                            <span className="text-[10px] text-gray-500 ml-1">({Math.floor(teamBScore.balls_bowled/6)}.{teamBScore.balls_bowled%6})</span>
                          </span>
                        )}
                      </div>

                      {/* Action Links */}
                      <div className="px-3 py-2 bg-black/30 border-t border-gray-800 flex gap-2">
                        {(() => {
                          const isPlaceholder = f.team_a?.team_name?.startsWith('TBD') || f.team_b?.team_name?.startsWith('TBD');
                          return (
                            <>
                              {!isPlaceholder && f.status === 'upcoming' && f.team_a && f.team_b && (
                                <Link to={`/admin/toss/${f.id}`} className="flex-1 text-center bg-cricket-accent text-black text-xs font-bold py-1.5 rounded uppercase">Toss</Link>
                              )}
                              {!isPlaceholder && f.status === 'toss' && (
                                <Link to={`/admin/toss/${f.id}`} className="flex-1 text-center bg-cricket-lightGreen text-white text-xs font-bold py-1.5 rounded uppercase">Start</Link>
                              )}
                              {!isPlaceholder && f.status === 'live' && (
                                <Link to={`/admin/scoring/${f.id}`} className="flex-1 text-center bg-red-600 text-white text-xs font-bold py-1.5 rounded uppercase animate-pulse">Score</Link>
                              )}
                              <Link to={`/watch/${f.id}`} className="flex-1 text-center bg-blue-600/80 text-white text-xs font-bold py-1.5 rounded uppercase">Watch</Link>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
