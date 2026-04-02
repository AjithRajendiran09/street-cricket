import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export default function Watch() {
  const { fixtureId } = useParams();
  const [fixture, setFixture] = useState(null);
  const [teamA, setTeamA] = useState(null);
  const [teamB, setTeamB] = useState(null);
  const [scores, setScores] = useState({ 1: null, 2: null });
  const [balls, setBalls] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMatchData = async () => {
    try {
      const res = await fetch(`${API_BASE}/tournament/fixtures/${fixtureId}`);
      const data = await res.json();
      setFixture(data);
      setTeamA(data.team_a);
      setTeamB(data.team_b);
      
      const scoreDict = { 1: null, 2: null };
      if (data.match_scores) {
        data.match_scores.forEach(s => { scoreDict[s.innings] = s; });
      }
      setScores(scoreDict);
      
      if (data.ball_by_ball) {
        setBalls(data.ball_by_ball.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)));
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMatchData();

    // Aggressive REST Polling Fallback (Every 5 seconds)
    const pollInterval = setInterval(() => {
       fetchMatchData();
    }, 5000);

    const scoresSub = supabase.channel('scores-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_scores', filter: `fixture_id=eq.${fixtureId}` }, () => fetchMatchData())
      .subscribe();

    const ballsSub = supabase.channel('balls-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ball_by_ball', filter: `fixture_id=eq.${fixtureId}` }, () => fetchMatchData())
      .subscribe();
      
    const fixtureSub = supabase.channel('fixture-watch')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fixtures', filter: `id=eq.${fixtureId}` }, () => fetchMatchData())
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(scoresSub);
      supabase.removeChannel(ballsSub);
      supabase.removeChannel(fixtureSub);
    };
  }, [fixtureId]);

  if (loading) return <div>Loading Live Coverage...</div>;
  if (!fixture) return <div>Match not found.</div>;

  const isMatchComplete = fixture.status === 'completed';
  const activeInningsScore = scores[2] && !scores[2].is_completed ? scores[2] : (scores[1] && !scores[1].is_completed ? scores[1] : (scores[2] || scores[1]));
  
  const getRR = (runs, balls) => balls > 0 ? (runs / (balls / 6)).toFixed(2) : "0.00";
  const getRRR = (target, runs, totalBalls, bowlsBowled) => {
      const runsNeeded = target - runs;
      const ballsRem = totalBalls - bowlsBowled;
      if (ballsRem <= 0) return "N/A";
      return (runsNeeded / (ballsRem / 6)).toFixed(2);
  };

  const getResultString = () => {
      if (!isMatchComplete) return "Match In Progress";
      
      if (!scores[1] || !scores[2]) return "Match Abandoned/Incomplete";
      
      if (scores[2].runs >= scores[1].runs + 1) {
          const wTeam = teamA?.id === scores[2].team_id ? teamA?.team_name : teamB?.team_name;
          return `${wTeam} won by ${2 - scores[2].wickets} wickets`;
      } else if (scores[1].runs > scores[2].runs) {
          const wTeam = teamA?.id === scores[1].team_id ? teamA?.team_name : teamB?.team_name;
          return `${wTeam} won by ${scores[1].runs - scores[2].runs} runs`;
      } else {
          return "Match Tied!";
      }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="bg-cricket-card p-6 rounded-xl border border-gray-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-red-600 px-4 py-1 text-xs font-bold uppercase tracking-widest text-white rounded-bl-lg flex items-center gap-2">
            {!isMatchComplete ? <><span className="w-2 h-2 bg-white rounded-full animate-ping"></span> Live</> : 'Finished'}
        </div>
        
        <h1 className="text-xl font-bold text-gray-400 uppercase tracking-widest text-center mb-6 mt-2 border-b border-gray-800 pb-2 flex items-center justify-center gap-2">
           <span>{teamA?.team_name}</span> 
           <span className="text-xs text-cricket-accent mx-2 italic">Vs</span> 
           <span>{teamB?.team_name}</span>
        </h1>

        {activeInningsScore ? (
            <div className="flex flex-col items-center">
               <div className="text-8xl w-full text-center font-black text-white bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400 tracking-tighter tabular-nums drop-shadow-2xl">
                 {activeInningsScore.runs}<span className="text-5xl text-gray-500 font-bold ml-1">/{activeInningsScore.wickets}</span>
               </div>
               
               <div className="flex w-full mt-8 bg-black rounded-lg divide-x divide-gray-800 border border-gray-800 p-4">
                  <div className="flex-1 text-center">
                     <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">Overs</p>
                     <p className="text-3xl font-bold text-cricket-accent mt-1">{Math.floor(activeInningsScore.balls_bowled/6)}.{activeInningsScore.balls_bowled%6}<span className="text-sm font-normal text-gray-500">/{fixture.total_overs}</span></p>
                  </div>
                  <div className="flex-1 text-center">
                     <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">Run Rate</p>
                     <p className="text-3xl font-bold text-white mt-1">{getRR(activeInningsScore.runs, activeInningsScore.balls_bowled)}</p>
                  </div>
               </div>

               {activeInningsScore.target && !isMatchComplete && (
                  <div className="mt-4 w-full bg-yellow-900/30 border border-yellow-700 p-4 rounded-lg flex flex-col md:flex-row justify-between items-center text-center gap-4">
                      <div className="text-lg text-yellow-500 font-bold uppercase tracking-widest">
                         Need {activeInningsScore.target - activeInningsScore.runs} off {(fixture.total_overs * 6) - activeInningsScore.balls_bowled}
                      </div>
                      <div className="bg-black px-4 py-2 rounded text-sm text-yellow-600 font-bold flex gap-4">
                         <span>Target: {activeInningsScore.target}</span>
                         <span>RRR: {getRRR(activeInningsScore.target, activeInningsScore.runs, fixture.total_overs*6, activeInningsScore.balls_bowled)}</span>
                      </div>
                  </div>
               )}

               {isMatchComplete && (
                  <div className="mt-6 w-full bg-cricket-lightGreen/20 border border-cricket-green py-4 px-6 rounded-lg text-center font-bold text-xl uppercase tracking-widest text-green-400">
                     {getResultString()}
                  </div>
               )}
            </div>
        ) : <div className="text-center text-gray-500 py-10 uppercase tracking-widest">Match starting soon...</div>}
      </div>

      <div className="bg-cricket-card p-6 rounded-xl border border-gray-800 shadow-xl">
         <h3 className="text-sm text-gray-400 font-bold uppercase tracking-widest mb-4 border-b border-gray-800 pb-2">Ball by Ball Timeline</h3>
         <div className="space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-700">
            {balls.map((b, i) => {
               let bg = 'bg-gray-800 text-gray-300';
               let label = b.runs_scored;
               let desc = `${b.runs_scored} runs`;
               if (b.is_wicket) { bg = 'bg-red-600 text-white font-bold animate-pulse'; label = 'W'; desc = `Wicket! (${b.wicket_type || 'OUT'})`; }
               else if (b.is_wide) { bg = 'bg-orange-600 text-white font-bold'; label = `WD+${b.runs_scored}`; desc = `Wide + ${b.runs_scored}`; }
               else if (b.is_no_ball) { bg = 'bg-purple-600 text-white font-bold'; label = `NB+${b.runs_scored}`; desc = `No Ball + ${b.runs_scored}`; }
               else if (b.runs_scored === 4) { bg = 'bg-blue-600 text-white font-bold'; label = '4'; desc = 'FOUR runs!'; }
               else if (b.runs_scored === 6) { bg = 'bg-green-600 text-white font-bold scale-110'; label = '6'; desc = 'SIX runs!!'; }
               else if (b.runs_scored === 0 && !b.is_wicket && !b.is_wide && !b.is_no_ball) { desc = "Dot ball"; }
               
               return (
                  <div key={b.id} className="flex items-center justify-between p-3 bg-black rounded-lg border border-gray-900 group hover:border-gray-700 transition">
                     <div className="flex items-center gap-4">
                         <div className={`w-12 h-12 flex items-center justify-center rounded-full text-lg shadow-inner ${bg}`}>
                             {label}
                         </div>
                         <div>
                             <p className="font-bold text-gray-200 text-sm">{desc}</p>
                             <p className="text-xs text-gray-600 mt-1 uppercase tracking-widest">Over {b.over_number}.{b.ball_number}</p>
                         </div>
                     </div>
                     <div className="text-xs text-gray-700">Innings {b.innings}</div>
                  </div>
               )
            })}
            {balls.length === 0 && <p className="text-gray-600 text-center italic">No balls bowled yet.</p>}
         </div>
      </div>
    </div>
  );
}
