import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export default function Home() {
  const [tournaments, setTournaments] = useState([]);
  const [form, setForm] = useState({ name: '', ground: '' });
  const [activeId, setActiveId] = useState(localStorage.getItem('active_tournament') || '');
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_BASE}/tournament/list`)
      .then(res => res.json())
      .then(data => setTournaments(data || []))
      .catch(err => console.error(err));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/tournament/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        setTournaments([data, ...tournaments]);
        setForm({ name: '', ground: '' });
        selectTournament(data.id);
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTournament = async (e, id, name) => {
    e.stopPropagation();
    if (!window.confirm(`Are you absolutely sure you want to permanently delete the season "${name}" and all of its matches and teams? This cannot be undone.`)) return;

    try {
      const res = await fetch(`${API_BASE}/tournament/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTournaments(tournaments.filter(t => t.id !== id));
        if (activeId === id) {
          localStorage.removeItem('active_tournament');
          setActiveId('');
        }
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const selectTournament = (id) => {
    setActiveId(id);
    localStorage.setItem('active_tournament', id);
    navigate('/teams');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-10 px-4">
      <div className="space-y-4 max-w-2xl animate-fade-in relative pt-10">
         <div className="absolute -top-10 -left-10 w-32 h-32 bg-cricket-green rounded-full blur-3xl opacity-20"></div>
         <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-cricket-accent rounded-full blur-3xl opacity-20"></div>
        <h1 className="text-5xl md:text-7xl font-black text-white uppercase tracking-tighter drop-shadow-2xl">StreetBash <span className="text-cricket-accent">League</span></h1>
        <p className="text-lg md:text-xl text-gray-400 max-w-lg mx-auto uppercase tracking-widest font-bold bg-black/50 py-2 rounded-full border border-gray-800">The Ultimate Match Manager</p>
      </div>

      <div className="w-full max-w-3xl bg-cricket-card p-8 rounded-2xl border border-gray-800 shadow-2xl mt-12 z-10">
         <h2 className="text-2xl font-bold text-white uppercase tracking-widest border-b border-gray-700 pb-4 mb-6">Select Active Season</h2>
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Create New */}
            <div className="bg-black/60 p-6 rounded-xl border border-gray-700 shadow-inner">
               <h3 className="text-lg font-bold text-cricket-lightGreen uppercase tracking-widest mb-4">Start New Tournament</h3>
               <form onSubmit={handleCreate} className="space-y-4 text-left">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Tournament Name *</label>
                    <input required placeholder="e.g. Summer Bash 2026" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-white focus:border-cricket-lightGreen focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Ground / Turf</label>
                    <input value={form.ground} onChange={e => setForm({...form, ground: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-white focus:border-cricket-lightGreen focus:outline-none" placeholder="e.g. Main Street Turf" />
                  </div>
                  <button type="submit" className="w-full bg-cricket-lightGreen hover:bg-green-600 text-white font-bold py-3 rounded-lg uppercase tracking-wider transition shadow-[0_0_15px_rgba(34,197,94,0.4)]">Launch Event</button>
               </form>
            </div>

            {/* Load Existing */}
            <div className="bg-black/60 p-6 rounded-xl border border-gray-700 shadow-inner flex flex-col pt-6">
               <h3 className="text-lg font-bold text-cricket-accent uppercase tracking-widest mb-4">Load Existing History</h3>
               <div className="space-y-3 overflow-y-auto flex-1 max-h-64 pr-2 custom-scrollbar">
                  {tournaments.length === 0 && <p className="text-gray-500 italic text-sm p-4">No tournaments found. Create your first season!</p>}
                  {tournaments.map(t => (
                     <div key={t.id} className="relative group">
                       <button onClick={() => selectTournament(t.id)} className={`w-full text-left p-4 rounded-xl border transition-all hover:scale-[1.02] shadow-md flex justify-between items-center ${activeId === t.id ? 'bg-cricket-accent text-black border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.4)]' : 'bg-gray-800 text-white border-gray-700 hover:bg-gray-700'}`}>
                          <div className="pr-10">
                             <p className="font-extrabold uppercase truncate tracking-wider text-lg">{t.name}</p>
                             <p className={`text-xs opacity-80 uppercase tracking-widest font-bold ${activeId === t.id ? 'text-black' : 'text-gray-400'}`}>{t.ground || 'Unknown Ground'}</p>
                          </div>
                          {activeId === t.id && <span className="font-black text-xl mr-2">✓</span>}
                       </button>
                       <button onClick={(e) => handleDeleteTournament(e, t.id, t.name)} className="absolute top-1/2 -translate-y-1/2 right-4 p-2 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition shadow-lg hover:bg-red-500 hover:scale-110 focus:opacity-100" title="Delete Tournament">
                         <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                       </button>
                     </div>
                  ))}
               </div>
            </div>
         </div>
      </div>

    </div>
  );
}
