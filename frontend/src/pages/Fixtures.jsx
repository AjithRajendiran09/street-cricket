import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export default function Fixtures({ isAdminMode = false }) {
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [leagueOvers, setLeagueOvers] = useState(2);
  const [playoffOvers, setPlayoffOvers] = useState(3);
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const activeTournamentId = localStorage.getItem('active_tournament');
  const showError = (msg) => { setError(msg); setTimeout(() => setError(null), 4000); };

  const fetchFixtures = async () => {
    if (!activeTournamentId) return;
    try {
      const res = await fetch(`${API_BASE}/tournament/fixtures?tournament_id=${activeTournamentId}`);
      if (!res.ok) throw new Error("Failed to load Fixtures API.");
      const data = await res.json();
      
      // Explicit Fixture Ordering: Live First, then Upcoming, then Completed!
      const priority = { 'live': 1, 'toss': 2, 'upcoming': 3, 'completed': 4, 'super_over': 1 };
      data.sort((a,b) => (priority[a.status] || 5) - (priority[b.status] || 5));
      
      setFixtures(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!activeTournamentId) {
       navigate('/');
    } else {
       fetchFixtures();
    }
  }, [activeTournamentId, navigate]);

  const handleGenerateLeague = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/tournament/generate-league`, {
        method: 'POST',
        headers: { 
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({ defaultOvers: leagueOvers, tournament_id: activeTournamentId })
      });
      if (res.ok) await fetchFixtures();
      else {
        const err = await res.json();
        showError(err.error);
      }
    } catch (err) {
      console.log(err);
    }
    setLoading(false);
  };

  const handleGeneratePlayoffs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/tournament/generate-playoffs`, {
        method: 'POST',
        headers: { 
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({ playoffOvers: playoffOvers, tournament_id: activeTournamentId })
      });
      if (res.ok) await fetchFixtures();
      else {
        const err = await res.json();
        showError(err.error);
      }
    } catch (err) {
      console.log(err);
    }
    setLoading(false);
  };

  const handleGenerateFinal = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/tournament/generate-final`, {
        method: 'POST',
        headers: { 
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({ playoffOvers: playoffOvers, tournament_id: activeTournamentId })
      });
      if (res.ok) await fetchFixtures();
      else {
        const err = await res.json();
        showError(err.error);
      }
    } catch (err) {
      console.log(err);
    }
    setLoading(false);
  };

  const renderAction = (f) => {
    if (!isAdminMode) return null; // Public users cannot operate Matches

    switch (f.status) {
      case 'upcoming':
        return <Link to={`/admin/toss/${f.id}`} className="bg-cricket-accent hover:bg-yellow-600 text-black px-4 py-2 rounded text-sm font-bold w-full mb-2 text-center uppercase">Do Toss</Link>;
      case 'toss':
        return <Link to={`/admin/toss/${f.id}`} className="bg-cricket-lightGreen hover:bg-green-600 text-white px-4 py-2 rounded text-sm font-bold w-full mb-2 text-center uppercase">Start Match</Link>;
      case 'live':
        return <Link to={`/admin/scoring/${f.id}`} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-bold animate-pulse w-full mb-2 text-center uppercase">Score Live</Link>;
      case 'completed':
        return <span className="bg-gray-800 text-gray-400 px-4 py-2 rounded text-sm font-bold w-full mb-2 text-center uppercase select-none">Completed</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {error && <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-600 text-white font-bold px-6 py-3 rounded-lg shadow-2xl z-50 animate-fade-in text-center border border-red-800 tracking-wider flex items-center justify-center gap-2 w-[90%] max-w-sm"><span>⚠️</span> {error}</div>}
      <div className="flex flex-col md:flex-row justify-between items-center border-b border-gray-700 pb-2">
        <h1 className="text-3xl font-bold text-cricket-accent uppercase w-full md:w-auto text-center md:text-left mb-4 md:mb-0">Fixtures</h1>
      </div>
      
      {isAdminMode && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-cricket-card p-4 rounded-xl border border-gray-800">
              <div className="flex flex-col gap-2 p-2 relative">
                 <h3 className="font-bold text-lg mb-2 text-white">League Generation</h3>
                 <label className="text-sm text-gray-400">Total Overs per Match</label>
                 <input disabled={fixtures.length > 0} type="number" min="1" value={leagueOvers} onChange={e => setLeagueOvers(Number(e.target.value))} className="bg-black text-white p-2 rounded border border-gray-700 disabled:opacity-50" />
                 <button onClick={handleGenerateLeague} disabled={loading || fixtures.length > 0} className="mt-2 bg-cricket-green hover:bg-green-700 text-white p-2 rounded font-bold uppercase disabled:opacity-50 transition">
                   {fixtures.length > 0 ? 'League Locked 🔒' : 'Generate League Matches'}
                 </button>
              </div>
              <div className="flex flex-col gap-2 p-2 relative">
                 <h3 className="font-bold text-lg mb-2 text-white">Playoff Generation</h3>
                 <label className="text-sm text-gray-400">Total Overs per Match</label>
                 <input disabled={fixtures.some(f => f.match_type === 'Final')} type="number" min="1" value={playoffOvers} onChange={e => setPlayoffOvers(Number(e.target.value))} className="bg-black text-white p-2 rounded border border-gray-700 disabled:opacity-50" />
                 
                 {!fixtures.some(f => ['SF1', 'SF2', 'Semifinal', 'Final'].includes(f.match_type)) ? (
                     <button onClick={handleGeneratePlayoffs} disabled={loading} className="mt-2 bg-yellow-600 hover:bg-yellow-700 text-black p-2 rounded font-bold uppercase transition disabled:bg-gray-700 disabled:text-gray-500">
                       Generate Playoffs
                     </button>
                 ) : fixtures.some(f => ['SF1', 'SF2', 'Semifinal'].includes(f.match_type)) && !fixtures.some(f => f.match_type === 'Final') ? (
                     <button onClick={handleGenerateFinal} disabled={loading} className="mt-2 bg-yellow-500 hover:bg-yellow-400 text-black p-2 rounded font-black uppercase transition border-2 border-yellow-700 shadow-[0_0_15px_rgba(234,179,8,0.4)] hover:scale-[1.02]">
                       Generate Final 🏆
                     </button>
                 ) : (
                     <button disabled className="mt-2 bg-gray-800 text-gray-500 p-2 rounded font-bold uppercase transition">
                       Playoffs Locked 🔒
                     </button>
                 )}
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fixtures.length === 0 && <p className="text-gray-500 italic p-4">No fixtures created yet.</p>}
        {fixtures.map(f => (
          <div key={f.id} className="bg-cricket-card rounded-xl border border-gray-800 overflow-hidden shadow-lg flex flex-col">
            <div className={`p-2 font-bold text-xs uppercase tracking-widest flex justify-between px-4 ${f.status === 'live' ? 'bg-red-800 text-white' : f.status === 'completed' ? 'bg-gray-800 text-gray-400' : 'bg-gray-700 text-gray-300'}`}>
               <span>{f.match_type || 'League'} • {f.total_overs} Overs</span>
               <span>{f.status}</span>
            </div>
            <div className="p-4 flex flex-col flex-1 text-center justify-center">
              <div className="flex justify-between items-center gap-4 py-4 px-2">
                 <div className="flex-1">
                    <h3 className="text-xl font-extrabold text-white uppercase">{f.team_a?.team_name || 'TBD'}</h3>
                 </div>
                 <div className="text-gray-500 font-bold italic text-lg uppercase bg-black rounded-full px-3 py-1">V/S</div>
                 <div className="flex-1">
                    <h3 className="text-xl font-extrabold text-white uppercase">{f.team_b?.team_name || 'TBD'}</h3>
                 </div>
              </div>
            </div>
            
            <div className="p-4 bg-black/30 border-t border-gray-800 flex flex-col gap-2">
               {renderAction(f)}
               <Link to={`/watch/${f.id}`} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold w-full text-center uppercase tracking-wider block">Watch Match</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
