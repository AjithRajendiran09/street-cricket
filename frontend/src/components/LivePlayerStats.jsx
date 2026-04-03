import React, { useMemo } from 'react';

export default function LivePlayerStats({ balls, activeInningsNum, currentStriker, currentBowler }) {
  const stats = useMemo(() => {
     if (!balls || !activeInningsNum) return { striker: null, bowler: null };
     
     const innBalls = balls.filter(b => b.innings === activeInningsNum);
     
     let striker = currentStriker;
     if (!striker && innBalls.length > 0) striker = innBalls[0].striker_name;
     let bowler = currentBowler;
     if (!bowler && innBalls.length > 0) bowler = innBalls[0].bowler_name;

     let sStats = null;
     if (striker) {
         const sBalls = innBalls.filter(b => b.striker_name === striker);
         sStats = {
             name: striker,
             runs: sBalls.reduce((a, b) => a + (b.runs_scored || 0), 0),
             balls: sBalls.filter(b => !b.is_wide).length,
             fours: sBalls.filter(b => b.runs_scored === 4).length,
             sixes: sBalls.filter(b => b.runs_scored === 6).length
         };
     }

     let bStats = null;
     if (bowler) {
         const bBalls = innBalls.filter(b => b.bowler_name === bowler);
         const legal = bBalls.filter(b => !b.is_wide && !b.is_no_ball).length;
         bStats = {
             name: bowler,
             overs: `${Math.floor(legal/6)}.${legal%6}`,
             runs: bBalls.reduce((a, b) => a + (b.runs_scored || 0) + (b.extras || 0), 0),
             wickets: bBalls.filter(b => b.is_wicket && b.wicket_type !== 'run_out').length
         };
     }
     
     return { striker: sStats, bowler: bStats };
  }, [balls, activeInningsNum, currentStriker, currentBowler]);

  if (!stats.striker && !stats.bowler) return null;

  return (
    <div className="w-full bg-black/60 border border-gray-800 rounded-lg p-3 mt-4 text-xs font-bold font-mono tracking-widest divide-y divide-gray-800">
       {stats.striker && (
           <div className="flex justify-between items-center py-2 text-gray-300">
              <span className="text-white truncate max-w-[40%] flex items-center gap-1">🏏 {stats.striker.name}</span>
              <span className="text-white font-black">{stats.striker.runs} <span className="text-gray-500 font-normal">({stats.striker.balls})</span></span>
              <span className="text-gray-500 hidden sm:inline">4s: <span className="text-blue-400">{stats.striker.fours}</span></span>
              <span className="text-gray-500 hidden sm:inline">6s: <span className="text-green-400">{stats.striker.sixes}</span></span>
           </div>
       )}
       {stats.bowler && (
           <div className="flex justify-between items-center py-2 text-gray-400">
              <span className="truncate max-w-[40%] flex items-center gap-1 text-cricket-accent">⚾ {stats.bowler.name}</span>
              <span><span className="hidden sm:inline">O: </span><span className="text-white">{stats.bowler.overs}</span></span>
              <span><span className="hidden sm:inline">R: </span><span className="text-white">{stats.bowler.runs}</span></span>
              <span><span className="hidden sm:inline">W: </span><span className="text-red-400">{stats.bowler.wickets}</span></span>
           </div>
       )}
    </div>
  );
}
