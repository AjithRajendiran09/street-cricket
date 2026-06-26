import React, { useState, useEffect } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const FORMAT_LIMITS = {
  league: { min: 2, max: 3, label: 'League (2-3 players)' },
  knockout: { min: 2, max: 11, label: 'Knockout (2-11 players)' },
  test: { min: 2, max: 11, label: 'Test Match (2-11 players)' }
};

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [playerInputs, setPlayerInputs] = useState(['', '']);
  const [teamName, setTeamName] = useState('');
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState(null);
  const activeTournamentId = localStorage.getItem('active_tournament');
  const activeFormat = localStorage.getItem('active_format') || 'league';
  const limits = FORMAT_LIMITS[activeFormat] || FORMAT_LIMITS.league;
  const navigate = useNavigate();
  
  const showError = (msg) => { setError(msg); setTimeout(() => setError(null), 4000); };

  const fetchTeams = async () => {
    if (!activeTournamentId) return;
    try {
      const res = await fetch(`${API_BASE}/teams?tournament_id=${activeTournamentId}`);
      const data = await res.json();
      setTeams(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!activeTournamentId) {
       navigate('/');
    } else {
       fetchTeams();
    }
  }, [activeTournamentId, navigate]);

  const getPlayersFromTeam = (team) => {
    if (team.players && Array.isArray(team.players)) return [...team.players];
    const legacy = [team.player1_name, team.player2_name, team.player3_name].filter(Boolean);
    return legacy.length > 0 ? legacy : ['', ''];
  };

  const handleEdit = (team) => {
    setEditId(team.id);
    setTeamName(team.team_name);
    setPlayerInputs(getPlayersFromTeam(team));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setTeamName('');
    setPlayerInputs(['', '']);
  };

  const addPlayerSlot = () => {
    if (playerInputs.length >= limits.max) return;
    setPlayerInputs([...playerInputs, '']);
  };

  const removePlayerSlot = (index) => {
    if (playerInputs.length <= limits.min) return;
    setPlayerInputs(playerInputs.filter((_, i) => i !== index));
  };

  const updatePlayer = (index, value) => {
    const updated = [...playerInputs];
    updated[index] = value;
    setPlayerInputs(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmed = playerInputs.map(p => p.trim()).filter(p => p.length > 0);
    
    if (trimmed.length < limits.min) {
      showError(`At least ${limits.min} players are required.`);
      return;
    }

    // Check for duplicates
    const lower = trimmed.map(p => p.toLowerCase());
    const unique = new Set(lower);
    if (unique.size !== lower.length) {
      showError('All player names within a team must be unique.');
      return;
    }

    try {
      const url = editId ? `${API_BASE}/teams/${editId}` : `${API_BASE}/teams`;
      const method = editId ? 'PUT' : 'POST';
      const payload = {
        team_name: teamName,
        players: trimmed,
        tournament_id: activeTournamentId
      };

      const res = await fetch(url, {
        method: method,
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setTeamName('');
        setPlayerInputs(['', '']);
        setEditId(null);
        fetchTeams();
      } else {
        const err = await res.json();
        showError(err.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (team) => {
    if (!window.confirm(`Are you sure you want to completely delete "${team.team_name}" and remove them from the tournament?`)) return;
    try {
      const res = await fetch(`${API_BASE}/teams/${team.id}`, { 
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      if (res.ok) {
         fetchTeams();
         if (editId === team.id) handleCancelEdit();
      } else {
         const err = await res.json();
         showError("Cannot delete team: " + err.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {error && <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-600 text-white font-bold px-6 py-3 rounded-lg shadow-2xl z-50 animate-fade-in text-center border border-red-800 tracking-wider w-[90%] max-w-sm">⚠️ {error}</div>}
      <div className="flex items-center justify-between border-b border-gray-700 pb-2">
        <h1 className="text-3xl font-bold text-cricket-accent uppercase">Teams</h1>
        <span className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
          activeFormat === 'test' ? 'bg-blue-900 text-blue-400 border-blue-700' :
          activeFormat === 'knockout' ? 'bg-orange-900 text-orange-400 border-orange-700' :
          'bg-green-900 text-green-400 border-green-700'
        }`}>{limits.label}</span>
      </div>
      
      <form onSubmit={handleSubmit} className={`bg-cricket-card p-6 rounded-xl border shadow-xl space-y-4 transition-colors duration-300 ${editId ? 'border-blue-500 bg-blue-900/20' : 'border-gray-800'}`}>
        <div className="flex justify-between items-center">
             <h2 className={`text-xl font-semibold uppercase tracking-widest ${editId ? 'text-blue-400' : 'text-white'}`}>
                {editId ? '✏️ Edit Team Details' : 'Register New Team'}
             </h2>
             {editId && <button type="button" onClick={handleCancelEdit} className="text-sm font-bold text-gray-400 hover:text-white uppercase tracking-wider bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded transition">Cancel</button>}
        </div>
        
        <div>
          <label className="block text-sm text-gray-400 mb-1">Team Name *</label>
          <input required value={teamName} onChange={e => setTeamName(e.target.value)} className="w-full bg-black border border-gray-700 rounded p-3 text-white focus:border-cricket-lightGreen focus:outline-none" />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm text-gray-400">Players ({playerInputs.length}/{limits.max})</label>
            {playerInputs.length < limits.max && (
              <button type="button" onClick={addPlayerSlot} className="flex items-center gap-1 text-xs font-bold text-cricket-lightGreen hover:text-green-400 uppercase tracking-wider bg-green-900/30 hover:bg-green-900/50 px-3 py-1.5 rounded-lg border border-green-800 transition">
                <Plus size={14} /> Add Player
              </button>
            )}
          </div>
          {playerInputs.map((player, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-bold w-6">P{idx + 1}</span>
              <input
                required={idx < limits.min}
                value={player}
                onChange={e => updatePlayer(idx, e.target.value)}
                placeholder={idx < limits.min ? `Player ${idx + 1} *` : `Player ${idx + 1} (optional)`}
                className="flex-1 bg-black border border-gray-700 rounded p-3 text-white focus:border-cricket-lightGreen focus:outline-none"
              />
              {playerInputs.length > limits.min && (
                <button type="button" onClick={() => removePlayerSlot(idx)} className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/30 rounded transition">
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        <button type="submit" className={`w-full py-4 rounded uppercase font-black tracking-widest transition shadow-lg ${editId ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-cricket-lightGreen hover:bg-cricket-green text-white'}`}>
           {editId ? 'Save Changes' : 'Register Team'}
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map(t => {
          const players = getPlayersFromTeam(t);
          return (
            <div key={t.id} className="bg-cricket-card p-4 rounded-xl border border-gray-800 flex flex-col justify-between relative group hover:border-gray-600 transition">
              <div className="absolute top-3 right-3 flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 shadow-md z-10 transition-opacity">
                  <button onClick={() => handleEdit(t)} className="p-1.5 bg-gray-800 text-gray-400 rounded hover:bg-blue-600 hover:text-white transition" title="Edit Team">
                     <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                  </button>
                  <button onClick={() => handleDelete(t)} className="p-1.5 bg-gray-800 text-gray-400 rounded hover:bg-red-600 hover:text-white transition" title="Delete Team">
                     <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                  </button>
              </div>
              <h3 className="text-xl font-bold text-white uppercase text-center border-b border-gray-700 pb-2 mb-3 pr-16 truncate tracking-wide">{t.team_name}</h3>
              <div className="space-y-1 text-gray-300 font-medium">
                {players.map((p, idx) => (
                  <p key={idx} className="flex justify-between">
                    <span className="text-gray-500">P{idx + 1}:</span>
                    <span className="text-white">{p}</span>
                  </p>
                ))}
              </div>
              <div className="mt-2 text-center">
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{players.length} Players</span>
              </div>
            </div>
          );
        })}
        {teams.length === 0 && <p className="text-gray-500 italic py-4 col-span-full text-center uppercase tracking-widest font-bold">No teams registered yet.</p>}
      </div>
    </div>
  );
}
