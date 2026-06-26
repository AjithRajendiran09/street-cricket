import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import LivePlayerStats from '../components/LivePlayerStats';
import FullScorecard from '../components/FullScorecard';
import MatchPrediction from '../components/MatchPrediction';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export default function Watch() {
  const { fixtureId } = useParams();
  const [fixture, setFixture] = useState(null);
  const [teamA, setTeamA] = useState(null);
  const [teamB, setTeamB] = useState(null);
  const [scores, setScores] = useState({ 1: null, 2: null, 3: null, 4: null });
  const [balls, setBalls] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMatchData = async () => {
    try {
      const res = await fetch(`${API_BASE}/tournament/fixtures/${fixtureId}`);
      const data = await res.json();
      
      // Guard against error responses
      if (!res.ok || data.error) {
        console.error('Match data error:', data);
        return;
      }
      
      setFixture(data);
      setTeamA(data.team_a);
      setTeamB(data.team_b);
      
      const scoreDict = { 1: null, 2: null, 3: null, 4: null };
      if (Array.isArray(data.match_scores)) {
        data.match_scores.forEach(s => { scoreDict[s.innings] = s; });
      }
      setScores(scoreDict);
      
      if (Array.isArray(data.ball_by_ball)) {
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

  const isMatchComplete = fixture?.status === 'completed';
  const inningsCount = fixture?.innings_count || 2;
  const isTestMatch = inningsCount === 4;

  // Find active innings
  const activeInningsScore = useMemo(() => {
    for (let i = 4; i >= 1; i--) {
      if (scores[i] && !scores[i].is_completed) return scores[i];
    }
    for (let i = 4; i >= 1; i--) {
      if (scores[i]) return scores[i];
    }
    return null;
  }, [scores]);
  
  // Calculate dynamic target
  const calculatedTarget = useMemo(() => {
    if (!activeInningsScore || !fixture) return null;
    
    if (isTestMatch) {
      if (activeInningsScore.innings === inningsCount) {
        const chasingTeamId = activeInningsScore.team_id;
        let chasingPrevRuns = 0;
        let settingRuns = 0;
        [scores[1], scores[2], scores[3], scores[4]].filter(Boolean).forEach(s => {
          if (s.innings === activeInningsScore.innings) return;
          if (s.team_id === chasingTeamId) chasingPrevRuns += s.runs;
          else settingRuns += s.runs;
        });
        return settingRuns - chasingPrevRuns + 1;
      }
      return null;
    } else {
      if (activeInningsScore.innings === 2 && scores[1]) return scores[1].runs + 1;
      return null;
    }
  }, [activeInningsScore, scores, fixture, isTestMatch, inningsCount]);

  if (loading) return <div>Loading Live Coverage...</div>;
  if (!fixture) return <div>Match not found.</div>;
  
  const getRR = (runs, balls) => balls > 0 ? (runs / (balls / 6)).toFixed(2) : "0.00";

  const getResultString = () => {
      if (!isMatchComplete) return "Match In Progress";
      
      if (isTestMatch) {
        let teamARuns = 0, teamBRuns = 0;
        [scores[1], scores[2], scores[3], scores[4]].filter(Boolean).forEach(s => {
          if (s.team_id === teamA?.id) teamARuns += s.runs;
          else teamBRuns += s.runs;
        });
        const allCompleted = [scores[1], scores[2], scores[3], scores[4]].filter(Boolean).every(s => s.is_completed);
        
        if (teamARuns > teamBRuns) return `${teamA?.team_name} won by ${teamARuns - teamBRuns} runs`;
        if (teamBRuns > teamARuns) return `${teamB?.team_name} won by ${teamBRuns - teamARuns} runs`;
        if (teamARuns === teamBRuns && allCompleted) return "Match Tied!";
        if (!allCompleted) return "Match Drawn";
        return "Match Completed";
      }

      if (!scores[1] || !scores[2]) return "Match Abandoned/Incomplete";
      
      if (scores[2].runs >= scores[1].runs + 1) {
          const wTeam = teamA?.id === scores[2].team_id ? teamA?.team_name : teamB?.team_name;
          const maxWickets = (() => {
            const team = teamA?.id === scores[2].team_id ? teamA : teamB;
            if (team?.players && Array.isArray(team.players)) return team.players.length;
            let c = 0;
            if (team?.player1_name) c++;
            if (team?.player2_name) c++;
            if (team?.player3_name) c++;
            return c;
          })();
          return `${wTeam} won by ${maxWickets - scores[2].wickets} wickets`;
      } else if (scores[1].runs > scores[2].runs) {
          const wTeam = teamA?.id === scores[1].team_id ? teamA?.team_name : teamB?.team_name;
          return `${wTeam} won by ${scores[1].runs - scores[2].runs} runs`;
      } else {
          return "Match Tied!";
      }
  };

  const getTeamName = (id) => id === teamA?.id ? teamA?.team_name : (id === teamB?.id ? teamB?.team_name : '');

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="bg-cricket-card p-6 rounded-xl border border-gray-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-red-600 px-4 py-1 text-xs font-bold uppercase tracking-widest text-white rounded-bl-lg flex items-center gap-2">
            {!isMatchComplete ? <><span className="w-2 h-2 bg-white rounded-full animate-ping"></span> Live</> : 'Finished'}
        </div>
        
        {isTestMatch && (
          <div className="absolute top-0 left-0 bg-blue-600 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white rounded-br-lg">
            Test Match
          </div>
        )}
        
        <h1 className="text-xl font-bold text-gray-400 uppercase tracking-widest text-center mb-6 mt-2 border-b border-gray-800 pb-2 flex items-center justify-center gap-2">
           <span>{teamA?.team_name}</span> 
           <span className="text-xs text-cricket-accent mx-2 italic">Vs</span> 
           <span>{teamB?.team_name}</span>
        </h1>

        {/* Test match innings summary */}
        {isTestMatch && (
          <div className="flex gap-1 w-full mb-4">
            {[1, 2, 3, 4].map(i => {
              const s = scores[i];
              const isActive = activeInningsScore?.innings === i && !isMatchComplete;
              return (
                <div key={i} className={`flex-1 p-2 rounded-lg text-center ${
                  isActive ? 'bg-cricket-accent/20 border border-cricket-accent' :
                  s ? 'bg-gray-800 border border-gray-700' : 'bg-gray-900/50 border border-gray-800/50'
                }`}>
                  <div className="text-[9px] text-gray-500 font-bold uppercase">Inn {i}</div>
                  {s ? (
                    <>
                      <div className={`text-sm font-black ${isActive ? 'text-white' : 'text-gray-300'}`}>{s.runs}/{s.wickets}</div>
                      <div className="text-[9px] text-gray-500 truncate">{getTeamName(s.team_id)}</div>
                      {s.is_declared && <div className="text-[8px] text-blue-400 font-bold">DEC</div>}
                    </>
                  ) : (
                    <div className="text-xs text-gray-600">—</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeInningsScore ? (
            <div className="flex flex-col items-center">
               <div className="text-8xl w-full text-center font-black text-white bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400 tracking-tighter tabular-nums drop-shadow-2xl">
                 {activeInningsScore.runs}<span className="text-5xl text-gray-500 font-bold ml-1">/{activeInningsScore.wickets}</span>
               </div>
               
               <div className="flex w-full mt-8 bg-black rounded-lg divide-x divide-gray-800 border border-gray-800 p-4">
                  <div className="flex-1 text-center">
                     <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">Overs</p>
                     <p className="text-3xl font-bold text-cricket-accent mt-1">{Math.floor(activeInningsScore.balls_bowled/6)}.{activeInningsScore.balls_bowled%6}<span className="text-sm font-normal text-gray-500">/{fixture.total_overs || '∞'}</span></p>
                  </div>
                  <div className="flex-1 text-center">
                     <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">Run Rate</p>
                     <p className="text-3xl font-bold text-white mt-1">{getRR(activeInningsScore.runs, activeInningsScore.balls_bowled)}</p>
                  </div>
               </div>

               {calculatedTarget && !isMatchComplete && (() => {
                  const runsNeeded = calculatedTarget - activeInningsScore.runs;
                  const totalBalls = fixture.total_overs ? fixture.total_overs * 6 : null;
                  const ballsLeft = totalBalls ? totalBalls - activeInningsScore.balls_bowled : null;
                  const crr = activeInningsScore.balls_bowled > 0 ? ((activeInningsScore.runs / activeInningsScore.balls_bowled) * 6).toFixed(2) : "0.00";
                  const rrr = ballsLeft && ballsLeft > 0 ? ((runsNeeded / ballsLeft) * 6).toFixed(2) : "N/A";

                  return (
                  <div className="mt-4 w-full bg-yellow-900/30 border border-yellow-700 p-4 rounded-lg flex flex-col justify-center items-center text-center gap-2 shadow-inner">
                      <div className="text-xl text-yellow-500 font-bold uppercase tracking-widest text-shadow">
                         Need {Math.max(0, runsNeeded)} runs {ballsLeft !== null ? `in ${Math.max(0, ballsLeft)} balls` : ''}
                      </div>
                      <div className="bg-black/50 px-4 py-2 rounded text-sm text-yellow-600 font-bold flex gap-4 tracking-widest mt-1">
                         <span>CRR: {crr}</span>
                         <span className="text-gray-700">|</span>
                         <span>RRR: {rrr}</span>
                      </div>
                  </div>
                  );
               })()}

               {isMatchComplete && (
                  <div className="mt-6 w-full bg-cricket-lightGreen/20 border border-cricket-green py-5 px-6 rounded-lg text-center font-bold text-xl uppercase tracking-widest text-green-400 relative overflow-hidden shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                     {getResultString()}
                     {fixture.match_type === 'Final' && (
                        <div className="mt-6 animate-bounce">
                           <div className="text-6xl drop-shadow-[0_0_20px_rgba(255,215,0,0.8)] mb-2">🏆</div>
                           <div className="text-yellow-400 font-black text-2xl tracking-tighter">TOURNAMENT CHAMPIONS!</div>
                        </div>
                     )}
                  </div>
               )}

               {!isMatchComplete && (
                  <LivePlayerStats 
                      balls={balls} 
                      activeInningsNum={activeInningsScore?.innings} 
                  />
               )}
            </div>
        ) : <div className="text-center text-gray-500 py-10 uppercase tracking-widest">Match starting soon...</div>}
      </div>

      {isMatchComplete && (
         <FullScorecard 
             fixture={fixture} 
             balls={balls} 
             scores={scores} 
             teamA={teamA} 
             teamB={teamB} 
         />
      )}

      {/* AI Prediction Card — shown for non-completed non-test matches */}
      {!isMatchComplete && !isTestMatch && (
         <MatchPrediction fixtureId={fixtureId} />
      )}

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
