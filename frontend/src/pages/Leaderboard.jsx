import React, { useState, useEffect } from 'react';
import { Trophy, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export default function Leaderboard() {
  const [stats, setStats] = useState({ batsmen: [], bowlers: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('batters');
  const [tournaments, setTournaments] = useState([]);
  
  // Default to currently active tournament if one exists, otherwise 'overall'
  const activeTournamentId = localStorage.getItem('active_tournament') || 'overall';
  const [selectedFilter, setSelectedFilter] = useState(activeTournamentId);

  useEffect(() => {
    // Fetch list of tournaments for the dropdown filter
    fetch(`${API_BASE}/tournament/list`)
      .then(res => res.json())
      .then(data => setTournaments(data || []))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/tournament/leaderboard?tournament_id=${selectedFilter}`)
      .then(res => res.json())
      .then(data => {
        setStats({ batsmen: data.batsmen || [], bowlers: data.bowlers || [] });
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [selectedFilter]);

  const exportPDF = () => {
      const el = document.getElementById('leaderboard-export');
      html2canvas(el, { scale: 2, backgroundColor: '#111827' }).then(canvas => {
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF('p', 'mm', 'a4');
          const w = pdf.internal.pageSize.getWidth();
          const h = (canvas.height * w) / canvas.width;
          pdf.addImage(imgData, 'PNG', 0, 0, w, h);
          pdf.save(`Tournament_${tab}.pdf`);
      });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10 flex flex-col">
       <button onClick={exportPDF} className="self-end bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-lg flex items-center gap-2 text-sm font-bold uppercase transition flex-shrink-0 shadow-lg">
          <Download size={16} /> Export Leaderboard
       </button>
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-black/40 p-6 rounded-2xl border border-gray-800 shadow-xl drop-shadow-xl mb-0">
         <h1 className="text-3xl font-black text-white uppercase flex items-center justify-center gap-3 w-full md:w-auto">
            <Trophy className="text-yellow-500 w-10 h-10" /> 
            Leaderboard
         </h1>
         
         <div className="w-full md:w-auto">
            <select value={selectedFilter} onChange={e => setSelectedFilter(e.target.value)} className="w-full md:w-64 bg-gray-900 border border-gray-700 text-white font-bold uppercase tracking-widest px-4 py-3 rounded-lg focus:outline-none focus:border-cricket-accent shadow-inner transition cursor-pointer appearance-none">
               <option value="overall" className="font-bold">🌍 All-Time Overall</option>
               <optgroup label="Specific Tournaments">
                  {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
               </optgroup>
            </select>
         </div>
      </div>

      {loading && <div className="p-8 text-center text-cricket-accent font-black uppercase tracking-widest animate-pulse">Computing Stats...</div>}

      {!loading && (
          <>
          <div className="flex bg-black rounded-lg p-1 border border-gray-800 shadow-2xl">
             <button onClick={() => setTab('batters')} className={`flex-1 py-4 text-center rounded-md font-black uppercase tracking-widest transition ${tab==='batters'?'bg-cricket-accent text-black shadow-lg':'text-gray-400 hover:text-white hover:bg-gray-900'}`}>Top Batsmen</button>
             <button onClick={() => setTab('bowlers')} className={`flex-1 py-4 text-center rounded-md font-black uppercase tracking-widest transition ${tab==='bowlers'?'bg-cricket-lightGreen text-white shadow-lg':'text-gray-400 hover:text-white hover:bg-gray-900'}`}>Top Bowlers</button>
          </div>

          <div id="leaderboard-export" className="bg-cricket-card p-2 border border-gray-800 rounded-xl overflow-hidden shadow-2xl animate-fade-in">
            <h2 className="text-white text-center font-black uppercase text-2xl hidden print:block mb-4 pt-4">{tab === 'batters' ? 'Top Batsmen Leaderboard' : 'Top Bowlers Leaderboard'}</h2>
            {tab === 'batters' ? (
              <table className="w-full text-left text-white">
                <thead className="bg-black border-b border-gray-800 text-gray-500 uppercase text-xs font-black tracking-widest">
                   <tr>
                      <th className="p-5">Rank</th>
                      <th className="p-5">Player</th>
                      <th className="p-5 text-right">Runs</th>
                      <th className="p-5 text-right hidden sm:table-cell">Balls</th>
                      <th className="p-5 text-right hidden sm:table-cell">4s/6s</th>
                      <th className="p-5 text-right hidden md:table-cell">SR</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                   {stats.batsmen.map((b, i) => (
                     <tr key={b.name} className="hover:bg-gray-900/80 transition-colors">
                        <td className="p-5 font-black text-gray-500 text-xl">#{i+1}</td>
                        <td className="p-5 font-black uppercase tracking-wider text-xl flex items-center gap-3">
                            {i === 0 && <span className="text-2xl" title="Orange Cap">🧢</span>}
                            {b.name}
                        </td>
                        <td className="p-5 text-right text-cricket-accent font-black text-3xl">{b.runs}</td>
                        <td className="p-5 text-right text-gray-400 hidden sm:table-cell text-lg">{b.balls}</td>
                        <td className="p-5 text-right hidden sm:table-cell text-gray-400 text-lg"><span className="text-blue-400">{b.fours}</span> / <span className="text-blue-500">{b.sixes}</span></td>
                        <td className="p-5 text-right font-mono text-lg hidden md:table-cell font-bold text-gray-300">
                           {b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}
                        </td>
                     </tr>
                   ))}
                   {stats.batsmen.length === 0 && <tr><td colSpan="6" className="p-12 text-center text-gray-500 font-bold uppercase tracking-widest">No data available</td></tr>}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-white">
                <thead className="bg-black border-b border-gray-800 text-gray-500 uppercase text-xs font-black tracking-widest">
                   <tr>
                      <th className="p-5">Rank</th>
                      <th className="p-5">Player</th>
                      <th className="p-5 text-right">Wickets</th>
                      <th className="p-5 text-right hidden sm:table-cell">Overs</th>
                      <th className="p-5 text-right hidden sm:table-cell">Runs</th>
                      <th className="p-5 text-right hidden md:table-cell">Econ</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                   {stats.bowlers.map((b, i) => (
                     <tr key={b.name} className="hover:bg-gray-900/80 transition-colors">
                        <td className="p-5 font-black text-gray-500 text-xl">#{i+1}</td>
                        <td className="p-5 font-black uppercase tracking-wider text-xl flex items-center gap-3">
                            {i === 0 && <span className="text-2xl" title="Purple Cap">🧢</span>}
                            {b.name}
                        </td>
                        <td className="p-5 text-right text-cricket-lightGreen font-black text-3xl">{b.wickets}</td>
                        <td className="p-5 text-right text-gray-400 hidden sm:table-cell text-lg">{Math.floor(b.balls_bowled/6)}.{b.balls_bowled%6}</td>
                        <td className="p-5 text-right text-gray-400 hidden sm:table-cell text-lg">{b.runs_conceded}</td>
                        <td className="p-5 text-right font-mono text-lg hidden md:table-cell font-bold text-gray-300">
                           {b.balls_bowled > 0 ? ((b.runs_conceded / b.balls_bowled) * 6).toFixed(1) : '0.0'}
                        </td>
                     </tr>
                   ))}
                   {stats.bowlers.length === 0 && <tr><td colSpan="6" className="p-12 text-center text-gray-500 font-bold uppercase tracking-widest">No data available</td></tr>}
                </tbody>
              </table>
            )}
          </div>
          </>
      )}
    </div>
  );
}
