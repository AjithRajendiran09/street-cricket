import React, { useMemo } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Download } from 'lucide-react';

export default function FullScorecard({ fixture, balls, scores, teamA, teamB, mvpPlayer }) {
  const getTeamName = (id) => id === teamA?.id ? teamA?.team_name : (id === teamB?.id ? teamB?.team_name : 'Unknown');

  const scorecards = useMemo(() => {
    if (!balls || !scores) return [];
    const innData = [];
    
    for (let inn of [1, 2]) {
      const sData = scores[inn];
      if (!sData) continue;
      const bData = balls.filter(b => b.innings === inn);
      if (bData.length === 0) continue;

      const batters = {};
      const bowlers = {};

      bData.forEach(b => {
         if (b.striker_name) {
             if (!batters[b.striker_name]) batters[b.striker_name] = { name: b.striker_name, runs: 0, balls: 0, fours: 0, sixes: 0, status: 'Not Out' };
             const st = batters[b.striker_name];
             if (!b.is_wide) {
                 st.balls += 1;
                 st.runs += (b.runs_scored || 0);
                 if (b.runs_scored === 4) st.fours += 1;
                 if (b.runs_scored === 6) st.sixes += 1;
             }
             if (b.is_wicket) st.status = `b ${b.bowler_name || 'Unknown'}`;
         }
         if (b.bowler_name) {
             if (!bowlers[b.bowler_name]) bowlers[b.bowler_name] = { name: b.bowler_name, legal: 0, runs: 0, wickets: 0, maidens: 0, wds: 0, nbs: 0 };
             const bo = bowlers[b.bowler_name];
             if (!b.is_wide && !b.is_no_ball) bo.legal += 1;
             bo.runs += (b.runs_scored || 0) + (b.extras || 0);
             if (b.is_wicket && b.wicket_type !== 'run_out') bo.wickets += 1;
             if (b.is_wide) bo.wds += 1;
             if (b.is_no_ball) bo.nbs += 1;
         }
      });

      innData.push({
          innings: inn,
          teamName: getTeamName(sData.team_id),
          runs: sData.runs,
          wickets: sData.wickets,
          overs: `${Math.floor(sData.balls_bowled/6)}.${sData.balls_bowled%6}`,
          extras: sData.extras,
          batting: Object.values(batters),
          bowling: Object.values(bowlers)
      });
    }
    return innData;
  }, [balls, scores, teamA, teamB]);

  const handleExportPDF = () => {
    const el = document.getElementById('match-scorecard-export');
    html2canvas(el, { scale: 2, useCORS: true }).then(canvas => {
       const imgData = canvas.toDataURL('image/png');
       const pdf = new jsPDF('p', 'mm', 'a4');
       const w = pdf.internal.pageSize.getWidth();
       const h = (canvas.height * w) / canvas.width;
       pdf.addImage(imgData, 'PNG', 0, 0, w, h);
       pdf.save(`${teamA?.team_name}_vs_${teamB?.team_name}_Scorecard.pdf`);
    });
  };

  if (scorecards.length === 0) return null;

  return (
    <div className="w-full mt-8">
      <button onClick={handleExportPDF} className="mb-4 w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 uppercase tracking-widest shadow-lg transition">
         <Download size={20} /> Export Match Summary to PDF
      </button>

      <div id="match-scorecard-export" className="bg-white text-black p-4 md:p-8 rounded-xl shadow-2xl font-sans print:p-0 print:shadow-none min-h-[300px]">
         <div className="text-center mb-6 border-b-4 border-gray-900 pb-4">
             <h1 className="text-3xl font-black uppercase">{fixture?.match_type === 'League' ? 'League Match' : fixture?.match_type} Summary</h1>
             <h2 className="text-xl font-bold mt-2 text-gray-700 uppercase">{teamA?.team_name} vs {teamB?.team_name}</h2>
         </div>

         {scorecards.map(inn => (
            <div key={inn.innings} className="mb-8">
                <div className="bg-gray-900 text-white px-4 py-2 font-black uppercase tracking-widest flex justify-between items-center rounded-t-lg">
                   <span>{inn.teamName} Innings</span>
                   <span>{inn.runs}/{inn.wickets} <span className="text-xs text-gray-400 font-normal">({inn.overs} Overs)</span></span>
                </div>
                
                {/* Batting */}
                <table className="w-full text-sm text-left border-collapse border border-gray-300">
                    <thead className="bg-gray-100 text-gray-800 uppercase font-bold text-xs">
                       <tr>
                          <th className="p-2 border border-gray-300">Batter</th>
                          <th className="p-2 border border-gray-300 hidden md:table-cell">Status</th>
                          <th className="p-2 border border-gray-300 text-center">R</th>
                          <th className="p-2 border border-gray-300 text-center">B</th>
                          <th className="p-2 border border-gray-300 text-center">4s</th>
                          <th className="p-2 border border-gray-300 text-center">6s</th>
                          <th className="p-2 border border-gray-300 text-center hidden sm:table-cell">SR</th>
                       </tr>
                    </thead>
                    <tbody className="bg-white text-black text-sm">
                       {inn.batting.map(b => (
                          <tr key={b.name} className="border-b border-gray-200">
                              <td className="p-2 border border-gray-300 font-bold whitespace-nowrap">
                                {b.name}
                                {mvpPlayer === b.name && <span className="text-[9px] bg-yellow-500 text-black px-1 rounded ml-2 animate-pulse shadow-sm relative -top-0.5 whitespace-nowrap">🌟 MVP</span>}
                                <div className="text-[10px] text-gray-500 font-normal md:hidden">{b.status}</div>
                              </td>
                              <td className="p-2 border border-gray-300 hidden md:table-cell text-gray-600">{b.status}</td>
                              <td className="p-2 border border-gray-300 text-center font-bold">{b.runs}</td>
                              <td className="p-2 border border-gray-300 text-center">{b.balls}</td>
                              <td className="p-2 border border-gray-300 text-center">{b.fours}</td>
                              <td className="p-2 border border-gray-300 text-center">{b.sixes}</td>
                              <td className="p-2 border border-gray-300 text-center hidden sm:table-cell">{b.balls > 0 ? ((b.runs/b.balls)*100).toFixed(1) : '-'}</td>
                          </tr>
                       ))}
                       <tr className="bg-gray-50 text-xs font-bold uppercase">
                          <td colSpan="2" className="p-2 border border-gray-300 hidden md:table-cell text-right">Extras</td>
                          <td className="p-2 border border-gray-300 md:hidden text-right">Ext</td>
                          <td colSpan="5" className="p-2 border border-gray-300 text-left font-black">{inn.extras}</td>
                       </tr>
                    </tbody>
                </table>

                {/* Bowling */}
                <table className="w-full text-sm text-center border-collapse border border-gray-300 mt-4">
                    <thead className="bg-gray-100 text-gray-800 uppercase font-bold text-xs">
                       <tr>
                          <th className="p-2 border border-gray-300 text-left">Bowler</th>
                          <th className="p-2 border border-gray-300">O</th>
                          <th className="p-2 border border-gray-300">R</th>
                          <th className="p-2 border border-gray-300 font-black text-red-600">W</th>
                          <th className="p-2 border border-gray-300 hidden sm:table-cell">Econ</th>
                       </tr>
                    </thead>
                    <tbody className="bg-white text-black text-sm">
                       {inn.bowling.map(b => {
                          const ov = b.legal / 6;
                          return (
                          <tr key={b.name} className="border-b border-gray-200">
                              <td className="p-2 border border-gray-300 text-left font-bold">
                                {b.name}
                                {mvpPlayer === b.name && <span className="text-[9px] bg-yellow-500 text-black px-1 rounded ml-2 animate-pulse shadow-sm relative -top-0.5 whitespace-nowrap">🌟 MVP</span>}
                              </td>
                              <td className="p-2 border border-gray-300">{Math.floor(b.legal/6)}.{b.legal%6}</td>
                              <td className="p-2 border border-gray-300">{b.runs}</td>
                              <td className="p-2 border border-gray-300 font-bold text-red-600">{b.wickets}</td>
                              <td className="p-2 border border-gray-300 hidden sm:table-cell">{ov > 0 ? (b.runs/ov).toFixed(1) : '-'}</td>
                          </tr>
                       )})}
                    </tbody>
                </table>
            </div>
         ))}
         
         <div className="mt-8 text-center text-xs font-bold text-gray-500 uppercase tracking-widest border-t-2 border-gray-200 pt-4">
            Official Data • Hurricane Street Cricket
         </div>
      </div>
    </div>
  );
}
