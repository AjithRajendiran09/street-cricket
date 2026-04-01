import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export default function History() {
  const [history, setHistory] = useState({});
  const activeTournamentId = localStorage.getItem('active_tournament');
  const navigate = useNavigate();

  useEffect(() => {
    if (!activeTournamentId) {
       navigate('/');
       return;
    }
    fetch(`${API_BASE}/tournament/fixtures?tournament_id=${activeTournamentId}`)
      .then(res => res.json())
      .then(data => {
        const completed = data.filter(f => f.status === 'completed');
        // Group by match end time or created at date
        const grouped = completed.reduce((acc, curr) => {
           let dString = curr.match_end_time || curr.created_at;
           let date = new Date(dString).toLocaleDateString();
           if (!acc[date]) acc[date] = [];
           acc[date].push(curr);
           return acc;
        }, {});
        setHistory(grouped);
      })
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-cricket-accent uppercase border-b border-gray-700 pb-2">Match History</h1>
      
      {Object.keys(history).length === 0 && (
         <div className="text-gray-500 italic p-6 bg-cricket-card rounded-xl border border-gray-800 text-center uppercase tracking-widest">No completed matches yet.</div>
      )}

      {Object.keys(history).map(date => (
         <div key={date} className="space-y-4">
            <h2 className="text-xl font-bold bg-cricket-green text-white inline-block px-4 py-1 rounded shadow-lg uppercase tracking-wider">{date}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {history[date].map(f => (
                  <div key={f.id} className="bg-cricket-card rounded-xl border border-gray-800 p-6 flex flex-col justify-between hover:border-gray-600 transition group shadow-2xl relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-cricket-accent to-transparent opacity-20"></div>
                     <div className="flex justify-between items-center mb-6 text-2xl font-black uppercase text-white">
                        <span className="truncate flex-1">{f.team_a?.team_name}</span>
                        <span className="text-gray-600 px-2 italic text-lg">v</span>
                        <span className="truncate flex-1 text-right">{f.team_b?.team_name}</span>
                     </div>
                     <div className="bg-black/50 p-3 rounded-lg border border-gray-800 mb-4 text-center">
                        <span className="text-gray-400 text-xs uppercase tracking-widest font-bold">Match Format</span>
                        <p className="text-cricket-accent font-mono mt-1">{f.total_overs} Overs</p>
                     </div>
                     <Link to={`/watch/${f.id}`} className="block w-full text-center bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-lg uppercase tracking-widest font-bold transition group-hover:bg-cricket-lightGreen">
                        View Scorecard
                     </Link>
                  </div>
               ))}
            </div>
         </div>
      ))}
    </div>
  );
}
