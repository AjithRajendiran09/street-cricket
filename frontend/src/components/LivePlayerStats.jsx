import React, { useMemo, useState, useEffect, useRef } from 'react';

export default function LivePlayerStats({ balls, activeInningsNum, currentStriker, currentBowler, battingTeam, bowlingTeam }) {
  const [milestone, setMilestone] = useState(null);
  const prevStatsRef = useRef({});

  const stats = useMemo(() => {
    if (!balls || !activeInningsNum) return null;
    
    const innBalls = balls.filter(b => b.innings === activeInningsNum);
    
    const getPlayers = (team) => {
      if (!team) return [];
      if (team.players && Array.isArray(team.players)) return team.players;
      return [team.player1_name, team.player2_name, team.player3_name].filter(Boolean);
    };

    const battingRoster = getPlayers(battingTeam);
    const bowlingRoster = getPlayers(bowlingTeam);

    // Identify out players
    const outPlayers = innBalls
        .filter(b => b.is_wicket && b.striker_name)
        .map(b => b.striker_name);

    // Identify all players who have batted
    const battedPlayers = [...new Set(innBalls.filter(b => b.striker_name).map(b => b.striker_name))];

    // Current Striker
    let striker = currentStriker;
    if (!striker && innBalls.length > 0) {
        striker = innBalls[0].striker_name;
        // Ensure the inferred striker is not out
        if (outPlayers.includes(striker)) striker = null;
    }

    // Non-Striker
    let nonStriker = battedPlayers.find(p => p !== striker && !outPlayers.includes(p));

    const getBatStats = (name, isStriker) => {
      if (!name) return null;
      const sBalls = innBalls.filter(b => b.striker_name === name);
      const legalBalls = sBalls.filter(b => !b.is_wide);
      const runs = legalBalls.reduce((a, b) => a + (b.runs_scored || 0), 0);
      const bCount = legalBalls.length;
      const fours = legalBalls.filter(b => b.runs_scored === 4).length;
      const sixes = legalBalls.filter(b => b.runs_scored === 6).length;
      const sr = bCount > 0 ? ((runs / bCount) * 100).toFixed(1) : "0.0";
      
      const recentSRuns = innBalls.slice(0, 3).filter(b => b.striker_name === name).reduce((a,b) => a + (b.runs_scored || 0), 0);
      const isOnFire = recentSRuns >= 10;

      return { name, runs, balls: bCount, fours, sixes, sr, isStriker, isOnFire };
    };

    const activeBatsmen = [];
    if (striker) activeBatsmen.push(getBatStats(striker, true));
    if (nonStriker) activeBatsmen.push(getBatStats(nonStriker, false));

    // Upcoming Batsmen
    const upcoming = battingRoster.filter(p => !outPlayers.includes(p) && p !== striker && p !== nonStriker);

    // Current Bowler
    let bowler = currentBowler;
    if (!bowler && innBalls.length > 0) bowler = innBalls[0].bowler_name;

    // Recent Bowlers
    const allBowlersThisInn = [...new Set(innBalls.filter(b => b.bowler_name).map(b => b.bowler_name))];
    const otherBowlers = allBowlersThisInn.filter(b => b !== bowler).slice(0, 2);

    const getBowlStats = (name, isCurrent) => {
      if (!name) return null;
      const bBalls = innBalls.filter(b => b.bowler_name === name);
      const legal = bBalls.filter(b => !b.is_wide && !b.is_no_ball).length;
      const runs = bBalls.reduce((a, b) => a + (b.runs_scored || 0) + (b.extras || 0), 0);
      const wickets = bBalls.filter(b => b.is_wicket && b.wicket_type !== 'run_out').length;
      const oversF = Math.floor(legal / 6);
      const ballsO = legal % 6;
      const overs = `${oversF}.${ballsO}`;
      const totalOversDec = oversF + (ballsO / 6);
      const er = totalOversDec > 0 ? (runs / totalOversDec).toFixed(1) : "0.0";
      
      const dots = bBalls.filter(b => (b.runs_scored||0) === 0 && !b.is_wide && !b.is_no_ball && (b.extras||0)===0 && !b.is_wicket).length;
      const recentBWickets = innBalls.slice(0, 6).filter(b => b.bowler_name === name && b.is_wicket && b.wicket_type !== 'run_out').length;
      const isOnFire = recentBWickets >= 2;

      return { name, overs, runs, wickets, er, dots, isCurrent, isOnFire };
    };

    const activeBowlers = [];
    if (bowler) activeBowlers.push(getBowlStats(bowler, true));
    otherBowlers.forEach(b => activeBowlers.push(getBowlStats(b, false)));

    return { activeBatsmen, upcoming, activeBowlers };
  }, [balls, activeInningsNum, currentStriker, currentBowler, battingTeam, bowlingTeam]);

  useEffect(() => {
    if (!stats) return;
    let newMilestone = null;

    stats.activeBatsmen.forEach(b => {
      const prevRuns = prevStatsRef.current[b.name]?.runs || 0;
      if (prevRuns < 50 && b.runs >= 50 && b.runs < 100) {
        newMilestone = { type: 'HALF CENTURY', name: b.name, value: b.runs };
      } else if (prevRuns < 100 && b.runs >= 100) {
        newMilestone = { type: 'CENTURY', name: b.name, value: b.runs };
      }
      prevStatsRef.current[b.name] = { ...prevStatsRef.current[b.name], runs: b.runs };
    });

    stats.activeBowlers.forEach(b => {
      const prevWickets = prevStatsRef.current[b.name]?.wickets || 0;
      if (prevWickets < 3 && b.wickets >= 3) {
        newMilestone = { type: '3-WICKET HAUL', name: b.name, value: b.wickets, suffix: 'Wickets' };
      }
      prevStatsRef.current[b.name] = { ...prevStatsRef.current[b.name], wickets: b.wickets };
    });

    if (newMilestone) {
      setMilestone(newMilestone);
      setTimeout(() => setMilestone(null), 6000);
      
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(`What a moment! ${newMilestone.name} reaches a ${newMilestone.type}!`);
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [stats]);

  if (!stats) return null;

  return (
    <div className="w-full bg-black/80 border border-gray-800 rounded-lg mt-4 overflow-hidden shadow-2xl font-mono relative">
      {/* MILESTONE BANNER */}
      {milestone && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in pointer-events-none p-4">
           <div className="text-7xl md:text-9xl animate-bounce mb-6 drop-shadow-2xl">🌟</div>
           <div className="text-4xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 uppercase tracking-widest text-center drop-shadow-[0_0_30px_rgba(234,179,8,0.4)] px-4">
              {milestone.type}
           </div>
           <div className="text-3xl md:text-5xl text-white font-black mt-6 uppercase tracking-widest text-center">
              {milestone.name}
           </div>
           <div className="text-2xl md:text-4xl text-gray-400 mt-4 font-mono font-bold bg-gray-900/50 px-6 py-2 rounded-full border border-gray-700">
              {milestone.value} {milestone.suffix || 'Runs'}
           </div>
        </div>
      )}

      {/* BATTING TABLE */}
      <div className="w-full">
        <div className="bg-gray-900 border-b border-gray-800 px-3 py-1.5 flex text-[10px] uppercase font-black text-gray-500 tracking-widest">
          <div className="flex-[3]">Batsman</div>
          <div className="flex-1 text-center">R</div>
          <div className="flex-1 text-center">B</div>
          <div className="flex-1 text-center">4s</div>
          <div className="flex-1 text-center">6s</div>
          <div className="flex-1 text-right">SR</div>
        </div>
        {stats.activeBatsmen.length > 0 ? stats.activeBatsmen.map((bat, idx) => (
          <div key={idx} className={`px-3 py-2 flex items-center text-sm ${idx !== stats.activeBatsmen.length -1 ? 'border-b border-gray-800/50' : ''} ${bat.isStriker ? 'bg-cricket-accent/10' : ''}`}>
             <div className="flex-[3] font-bold text-white flex items-center gap-1 truncate pr-2">
                {bat.name}
                {bat.isStriker && <span className="text-cricket-accent text-xs">🏏</span>}
                {bat.isOnFire && <span className="animate-pulse drop-shadow-[0_0_10px_red] text-xs">🔥</span>}
             </div>
             <div className="flex-1 text-center font-black text-white">{bat.runs}</div>
             <div className="flex-1 text-center text-gray-400 text-xs">{bat.balls}</div>
             <div className="flex-1 text-center text-blue-400 font-bold">{bat.fours}</div>
             <div className="flex-1 text-center text-green-400 font-bold">{bat.sixes}</div>
             <div className="flex-1 text-right text-gray-400 text-xs">{bat.sr}</div>
          </div>
        )) : (
          <div className="px-3 py-4 text-center text-xs text-gray-600 font-bold uppercase">Awaiting Batsman...</div>
        )}
      </div>

      {/* UPCOMING BATSMEN */}
      {stats.upcoming.length > 0 && (
         <div className="bg-gray-900/60 border-y border-gray-800 px-3 py-2 text-xs flex items-start gap-2">
            <span className="text-gray-500 font-bold uppercase whitespace-nowrap">Yet to bat:</span>
            <span className="text-gray-400 truncate">{stats.upcoming.join(', ')}</span>
         </div>
      )}
      
      {/* BOWLING TABLE */}
      <div className="w-full">
        <div className="bg-gray-900 border-b border-gray-800 px-3 py-1.5 flex text-[10px] uppercase font-black text-gray-500 tracking-widest">
          <div className="flex-[3]">Bowler</div>
          <div className="flex-1 text-center">O</div>
          <div className="flex-1 text-center">R</div>
          <div className="flex-1 text-center">W</div>
          <div className="flex-1 text-center">Dots</div>
          <div className="flex-1 text-right">Econ</div>
        </div>
        {stats.activeBowlers.length > 0 ? stats.activeBowlers.map((bowl, idx) => (
          <div key={idx} className={`px-3 py-2 flex items-center text-sm ${idx !== stats.activeBowlers.length -1 ? 'border-b border-gray-800/50' : ''} ${bowl.isCurrent ? 'bg-cricket-lightGreen/10' : ''}`}>
             <div className="flex-[3] font-bold text-white flex items-center gap-1 truncate pr-2">
                {bowl.name}
                {bowl.isCurrent && <span className="text-cricket-lightGreen text-xs animate-pulse">⚾</span>}
                {bowl.isOnFire && <span className="animate-pulse drop-shadow-[0_0_10px_red] text-xs">🔥</span>}
             </div>
             <div className="flex-1 text-center font-bold text-white">{bowl.overs}</div>
             <div className="flex-1 text-center font-bold text-white">{bowl.runs}</div>
             <div className="flex-1 text-center font-black text-red-400">{bowl.wickets}</div>
             <div className="flex-1 text-center text-gray-400 font-bold">{bowl.dots}</div>
             <div className="flex-1 text-right text-gray-400 text-xs">{bowl.er}</div>
          </div>
        )) : (
          <div className="px-3 py-4 text-center text-xs text-gray-600 font-bold uppercase">Awaiting Bowler...</div>
        )}
      </div>
    </div>
  );
}
