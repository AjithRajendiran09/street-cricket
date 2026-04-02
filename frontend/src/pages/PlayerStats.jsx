import React, { useState, useEffect } from 'react';
import { Trophy, Target, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export default function PlayerStats() {
   const [stats, setStats] = useState({ orangeCap: [], purpleCap: [] });
   const [loading, setLoading] = useState(true);
   const [activeTab, setActiveTab] = useState('orange');
   const navigate = useNavigate();
   const activeTournamentId = localStorage.getItem('active_tournament');

   useEffect(() => {
     if (!activeTournamentId) {
        navigate('/');
        return;
     }
     fetch(`${API_BASE}/tournament/player-stats?tournament_id=${activeTournamentId}`)
       .then(res => res.json())
       .then(data => { setStats(data); setLoading(false); })
       .catch(err => console.error(err));
   }, [activeTournamentId, navigate]);

   if (loading) return <div className="text-center p-8 text-gray-500 uppercase tracking-widest font-bold animate-pulse">Loading Analytics Engine...</div>;

   return (
       <div className="space-y-6 animate-fade-in max-w-3xl mx-auto pt-4">
          <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tighter border-b border-gray-800 pb-3 mb-6 flex items-center justify-center sm:justify-start gap-3">
             <Activity className="text-cricket-accent w-8 h-8" />
             Player Analytics
          </h1>

          <div className="flex gap-4 border-b border-gray-800 pb-6">
             <button onClick={() => setActiveTab('orange')} className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${activeTab === 'orange' ? 'bg-orange-950/50 border-orange-500 text-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.15)] scale-100' : 'border-gray-800 border bg-black text-gray-500 hover:border-gray-600 scale-[0.98]'}`}>
                <Trophy className={`w-8 h-8 mb-2 ${activeTab === 'orange' ? 'text-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,0.8)]' : ''}`} />
                <span className="font-black uppercase tracking-widest text-sm">Orange Cap</span>
                <span className="text-[10px] sm:text-xs uppercase font-bold tracking-wider opacity-70 mt-1">Top Run Scorers</span>
             </button>
             <button onClick={() => setActiveTab('purple')} className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${activeTab === 'purple' ? 'bg-purple-950/50 border-purple-500 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.15)] scale-100' : 'border-gray-800 border bg-black text-gray-500 hover:border-gray-600 scale-[0.98]'}`}>
                <Target className={`w-8 h-8 mb-2 ${activeTab === 'purple' ? 'text-purple-500 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]' : ''}`} />
                <span className="font-black uppercase tracking-widest text-sm">Purple Cap</span>
                <span className="text-[10px] sm:text-xs uppercase font-bold tracking-wider opacity-70 mt-1">Top Wicket Takers</span>
             </button>
          </div>

          <div className="bg-cricket-card rounded-xl border border-gray-800 overflow-hidden shadow-2xl relative">
             {activeTab === 'orange' && (
                 <table className="w-full text-left border-collapse">
                    <thead className="bg-orange-950/40 text-orange-500 text-[10px] sm:text-xs uppercase tracking-widest border-b border-orange-900/50">
                       <tr>
                          <th className="p-3 sm:p-4 w-10 sm:w-16 text-center">Rk</th>
                          <th className="p-3 sm:p-4">Batsman</th>
                          <th className="p-3 sm:p-4 text-center font-black">Runs</th>
                          <th className="p-3 sm:p-4 text-center hidden sm:table-cell">SR</th>
                          <th className="p-3 sm:p-4 text-center hidden md:table-cell">4s/6s</th>
                       </tr>
                    </thead>
                    <tbody className="text-xs sm:text-sm font-bold divide-y divide-gray-800 bg-black">
                       {stats.orangeCap.map((p, i) => (
                           <tr key={p.name} className="hover:bg-gray-900/50 transition">
                               <td className="p-3 sm:p-4 text-center text-gray-500 font-mono">{i+1}</td>
                               <td className="p-3 sm:p-4 text-white uppercase flex items-center gap-2 font-black tracking-wide">
                                  {i === 0 && <span className="bg-gradient-to-br from-orange-400 to-orange-600 w-2 h-2 sm:w-3 sm:h-3 rounded-full animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.8)]"></span>}
                                  {p.name}
                               </td>
                               <td className="p-3 sm:p-4 text-center font-black text-orange-400 text-base sm:text-xl">{p.runs}</td>
                               <td className="p-3 sm:p-4 text-center text-gray-500 hidden sm:table-cell tabular-nums">{p.strike_rate}</td>
                               <td className="p-3 sm:p-4 text-center hidden md:table-cell tabular-nums">
                                   <span className="text-blue-400 border border-blue-900 bg-blue-950/30 px-1.5 py-0.5 rounded">{p.fours}</span>
                                   <span className="mx-1 text-gray-600">/</span>
                                   <span className="text-green-500 border border-green-900 bg-green-950/30 px-1.5 py-0.5 rounded">{p.sixes}</span>
                               </td>
                           </tr>
                       ))}
                       {stats.orangeCap.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-gray-600 italic uppercase">No batting records found</td></tr>}
                    </tbody>
                 </table>
             )}

             {activeTab === 'purple' && (
                 <table className="w-full text-left border-collapse">
                    <thead className="bg-purple-950/40 text-purple-400 text-[10px] sm:text-xs uppercase tracking-widest border-b border-purple-900/50">
                       <tr>
                          <th className="p-3 sm:p-4 w-10 sm:w-16 text-center">Rk</th>
                          <th className="p-3 sm:p-4">Bowler</th>
                          <th className="p-3 sm:p-4 text-center font-black">Wkts</th>
                          <th className="p-3 sm:p-4 text-center hidden sm:table-cell">Econ</th>
                          <th className="p-3 sm:p-4 text-center hidden md:table-cell">Overs (Dots)</th>
                       </tr>
                    </thead>
                    <tbody className="text-xs sm:text-sm font-bold divide-y divide-gray-800 bg-black">
                       {stats.purpleCap.map((p, i) => (
                           <tr key={p.name} className="hover:bg-gray-900/50 transition border-l-2 border-transparent hover:border-purple-500">
                               <td className="p-3 sm:p-4 text-center text-gray-500 font-mono">{i+1}</td>
                               <td className="p-3 sm:p-4 text-white uppercase flex items-center gap-2 font-black tracking-wide">
                                  {i === 0 && <span className="bg-gradient-to-br from-purple-400 to-purple-600 w-2 h-2 sm:w-3 sm:h-3 rounded-full animate-pulse shadow-[0_0_10px_rgba(168,85,247,0.8)]"></span>}
                                  {p.name}
                               </td>
                               <td className="p-3 sm:p-4 text-center font-black text-purple-400 text-base sm:text-xl">{p.wickets}</td>
                               <td className="p-3 sm:p-4 text-center text-gray-500 hidden sm:table-cell tabular-nums">{p.economy}</td>
                               <td className="p-3 sm:p-4 text-center hidden md:table-cell text-gray-400 tabular-nums">
                                   {p.overs} 
                                   <span className="text-[10px] text-cricket-accent bg-yellow-900/20 border border-yellow-700/50 px-1 rounded ml-2" title="Dot Balls">{p.dots}</span>
                               </td>
                           </tr>
                       ))}
                       {stats.purpleCap.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-gray-600 italic uppercase">No bowling records found</td></tr>}
                    </tbody>
                 </table>
             )}
          </div>
       </div>
   );
}
