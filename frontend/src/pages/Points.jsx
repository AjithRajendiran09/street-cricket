import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export default function Points() {
  const [table, setTable] = useState([]);
  const activeTournamentId = localStorage.getItem('active_tournament');
  const navigate = useNavigate();

  useEffect(() => {
    if (!activeTournamentId) {
       navigate('/');
       return;
    }
    fetch(`${API_BASE}/tournament/points-table?tournament_id=${activeTournamentId}`)
      .then(res => res.json())
      .then(data => setTable(data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-cricket-accent uppercase border-b border-gray-700 pb-2">Points Table</h1>
      
      <div className="bg-cricket-card rounded-xl border border-gray-800 overflow-x-auto shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-black text-gray-400 text-xs tracking-widest uppercase font-black">
              <th className="p-4 border-b border-gray-800">Team</th>
              <th className="p-4 border-b border-gray-800 text-center">P</th>
              <th className="p-4 border-b border-gray-800 text-center">W</th>
              <th className="p-4 border-b border-gray-800 text-center">L</th>
              <th className="p-4 border-b border-gray-800 text-center text-cricket-accent">Pts</th>
              <th className="p-4 border-b border-gray-800 text-center">NRR</th>
            </tr>
          </thead>
          <tbody>
            {table.map((row, index) => (
              <tr key={row.team_id} className={`hover:bg-gray-900 transition ${index < 4 ? 'bg-gradient-to-r from-cricket-green/20 to-transparent' : ''}`}>
                <td className="p-4 border-b border-gray-800 font-bold uppercase text-white flex items-center gap-3">
                   <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${index === 0 ? 'bg-yellow-500 text-black' : 'bg-gray-800'}`}>{index + 1}</span>
                   {row.team_name}
                </td>
                <td className="p-4 border-b border-gray-800 text-center text-gray-300 font-mono">{row.matches_played}</td>
                <td className="p-4 border-b border-gray-800 text-center text-green-500 font-mono font-bold">{row.wins}</td>
                <td className="p-4 border-b border-gray-800 text-center text-red-500 font-mono">{row.losses}</td>
                <td className="p-4 border-b border-gray-800 text-center text-cricket-accent font-black text-lg">{row.points}</td>
                <td className="p-4 border-b border-gray-800 text-center text-gray-400 font-mono">{row.nrr.toFixed(3)}</td>
              </tr>
            ))}
            {table.length === 0 && (
              <tr><td colSpan="6" className="p-6 text-center text-gray-500 italic">No match data available</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="text-gray-500 text-xs text-center uppercase tracking-widest p-4">Top 4 Teams Qualify for Playoffs • Win=2, Tie=1, Loss=0</div>
    </div>
  );
}
