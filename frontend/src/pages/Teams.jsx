import React, { useState, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState({ team_name: '', player1_name: '', player2_name: '', player3_name: '' });
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState(null);
  const activeTournamentId = localStorage.getItem('active_tournament');
  const navigate = useNavigate(); // Needs import from react-router-dom
  
  const showError = (msg) => { setError(msg); setTimeout(() => setError(null), 4000); };

  const fetchTeams = async () => {
    if (!activeTournamentId) return;
    try {
      const res = await fetch(`${API_BASE}/teams?tournament_id=${activeTournamentId}`);
      const data = await res.json();
      setTeams(data);
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

  const handleEdit = (team) => {
    setEditId(team.id);
    setForm({
        team_name: team.team_name,
        player1_name: team.player1_name,
        player2_name: team.player2_name,
        player3_name: team.player3_name || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setForm({ team_name: '', player1_name: '', player2_name: '', player3_name: '' });
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    const p1 = form.player1_name.trim().toLowerCase();
    const p2 = form.player2_name.trim().toLowerCase();
    const p3 = form.player3_name ? form.player3_name.trim().toLowerCase() : null;

    if (p1 === p2 || (p3 && (p1 === p3 || p2 === p3))) {
      showError('All player names within a team must be unique.');
      return;
    }

    try {
      const url = editId ? `${API_BASE}/teams/${editId}` : `${API_BASE}/teams`;
      const method = editId ? 'PUT' : 'POST';
      const payload = { ...form, tournament_id: activeTournamentId };

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setForm({ team_name: '', player1_name: '', player2_name: '', player3_name: '' });
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
      const res = await fetch(`${API_BASE}/teams/${team.id}`, { method: 'DELETE' });
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
      <h1 className="text-3xl font-bold text-cricket-accent uppercase border-b border-gray-700 pb-2">Teams</h1>
      
      <form onSubmit={handleSubmit} className={`bg-cricket-card p-6 rounded-xl border shadow-xl space-y-4 transition-colors duration-300 ${editId ? 'border-blue-500 bg-blue-900/20' : 'border-gray-800'}`}>
        <div className="flex justify-between items-center">
             <h2 className={`text-xl font-semibold uppercase tracking-widest ${editId ? 'text-blue-400' : 'text-white'}`}>
                {editId ? '✏️ Edit Team Details' : 'Register New Team'}
             </h2>
             {editId && <button type="button" onClick={handleCancelEdit} className="text-sm font-bold text-gray-400 hover:text-white uppercase tracking-wider bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded transition">Cancel</button>}
        </div>
        
        <div>
          <label className="block text-sm text-gray-400 mb-1">Team Name *</label>
          <input required value={form.team_name} onChange={e => setForm({...form, team_name: e.target.value})} className="w-full bg-black border border-gray-700 rounded p-3 text-white focus:border-cricket-lightGreen focus:outline-none" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Player 1 *</label>
            <input required value={form.player1_name} onChange={e => setForm({...form, player1_name: e.target.value})} className="w-full bg-black border border-gray-700 rounded p-3 text-white focus:border-cricket-lightGreen focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Player 2 *</label>
            <input required value={form.player2_name} onChange={e => setForm({...form, player2_name: e.target.value})} className="w-full bg-black border border-gray-700 rounded p-3 text-white focus:border-cricket-lightGreen focus:outline-none" />
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Player 3 (Optional Sub)</label>
          <input value={form.player3_name} onChange={e => setForm({...form, player3_name: e.target.value})} className="w-full bg-black border border-gray-700 rounded p-3 text-white placeholder-gray-600 focus:border-cricket-lightGreen focus:outline-none" placeholder="Enter optional player name" />
        </div>
        <button type="submit" className={`w-full py-4 rounded uppercase font-black tracking-widest transition shadow-lg ${editId ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-cricket-lightGreen hover:bg-cricket-green text-white'}`}>
           {editId ? 'Save Changes' : 'Register Team'}
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map(t => (
          <div key={t.id} className="bg-cricket-card p-4 rounded-xl border border-gray-800 flex flex-col justify-between relative group hover:border-gray-600 transition">
            <div className="absolute top-3 right-3 flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 shadow-md z-10 transition-opacity">
                <button onClick={() => handleEdit(t)} className="p-1.5 bg-gray-800 text-gray-400 rounded hover:bg-blue-600 hover:text-white transition" title="Edit Team">
                   <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                </button>
                <button onClick={() => handleDelete(t)} className="p-1.5 bg-gray-800 text-gray-400 rounded hover:bg-red-600 hover:text-white transition" title="Delete Team">
                   <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </div>
            <h3 className="text-xl font-bold text-white uppercase text-center border-b border-gray-700 pb-2 mb-3 pr-16 truncate tracking-wide">{t.team_name}</h3>
            <div className="space-y-1 text-gray-300 font-medium">
              <p className="flex justify-between"><span>P1:</span> <span className="text-white">{t.player1_name}</span></p>
              <p className="flex justify-between"><span>P2:</span> <span className="text-white">{t.player2_name}</span></p>
              {t.player3_name ? <p className="flex justify-between text-cricket-accent mt-2"><span>Sub:</span> <span className="font-bold">{t.player3_name}</span></p> : <p className="flex justify-between text-gray-600 mt-2 italic text-sm"><span>Sub:</span> <span>None</span></p>}
            </div>
          </div>
        ))}
        {teams.length === 0 && <p className="text-gray-500 italic py-4 col-span-full text-center uppercase tracking-widest font-bold">No teams registered yet.</p>}
      </div>
    </div>
  );
}
