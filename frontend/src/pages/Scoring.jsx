import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Trophy } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export default function Scoring() {
  const { fixtureId } = useParams();
  const navigate = useNavigate();
  const [fixture, setFixture] = useState(null);
  const [teamA, setTeamA] = useState(null);
  const [teamB, setTeamB] = useState(null);
  const [scores, setScores] = useState({ 1: null, 2: null });
  const [balls, setBalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Player Tracking
  const [currentStriker, setCurrentStriker] = useState('');
  const [currentBowler, setCurrentBowler] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };
  const [error, setError] = useState(null);
  const showError = (msg) => { setError(msg); setTimeout(() => setError(null), 4000); };

  const speakDotBall = () => {
    const phrases = ["Chocolate coffee!", "Gowdru kabab!", "VCC kabab!", "Reddy biryani!", "Reddy porota!", "Attibele Anarkali!", "Ramakrishna paniyaram!"];
    const text = phrases[Math.floor(Math.random() * phrases.length)];
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = 1.2;
      utterance.rate = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  };

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

    const scoresSub = supabase.channel('scores-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_scores', filter: `fixture_id=eq.${fixtureId}` }, payload => {
        fetchMatchData();
      })
      .subscribe();

    const ballsSub = supabase.channel('balls-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ball_by_ball', filter: `fixture_id=eq.${fixtureId}` }, payload => {
        fetchMatchData();
      })
      .subscribe();
      
    const fixtureSub = supabase.channel('fixture-channel')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fixtures', filter: `id=eq.${fixtureId}` }, payload => {
        fetchMatchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(scoresSub);
      supabase.removeChannel(ballsSub);
      supabase.removeChannel(fixtureSub);
    };
  }, [fixtureId]);

  const addBall = async (payload) => {
    if (!currentStriker || !currentBowler) {
      showError("Please select the current Striker and Bowler first!");
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]); // Error vibration
      return;
    }

    if (navigator.vibrate) navigator.vibrate(40); // Native fast haptic feedback

    payload.striker_name = currentStriker;
    payload.bowler_name = currentBowler;

    if (payload.runs_scored === 0 && !payload.is_wide && !payload.is_no_ball && !payload.is_wicket) {
        speakDotBall();
    }

    // --- SUPER-FAST OPTIMISTIC UI UPDATE ---
    const activeInn = scores[2] && !scores[2].is_completed ? scores[2] : (scores[1] && !scores[1].is_completed ? scores[1] : (scores[2] || scores[1]));
    if (activeInn) {
       const isLegal = !payload.is_wide && !payload.is_no_ball;
       const optScore = { ...activeInn };
       optScore.runs += (payload.runs_scored || 0);
       if (!isLegal) { optScore.runs += 1; optScore.extras += 1; }
       if (isLegal) { optScore.balls_bowled += 1; }
       if (payload.is_wicket) { optScore.wickets += 1; }
       
       setScores(prev => ({ ...prev, [optScore.innings]: optScore }));
       
       const optBall = {
          id: Math.random().toString(),
          runs_scored: payload.runs_scored || 0,
          is_wicket: payload.is_wicket,
          is_wide: payload.is_wide,
          is_no_ball: payload.is_no_ball,
          striker_name: currentStriker,
          created_at: new Date().toISOString()
       };
       setBalls(prev => [optBall, ...prev].slice(0, 20)); // Keep UI fast
    }
    // ---------------------------------------

    try {
      const res = await fetch(`${API_BASE}/matches/ball/${fixtureId}`, {
         method: 'POST',
         headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
         },
         body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (!res.ok) showError(result.error);
      else {
        if (payload.is_wicket) {
            showToast("💥 WICKET!!");
            setCurrentStriker(''); // Force select new batsman
        }
        else if (result.updatedScore.is_completed) showToast("🏁 INNINGS COMPLETED!");
        else if (result.updatedScore.balls_bowled > 0 && result.updatedScore.balls_bowled % 6 === 0) {
            showToast("🏏 OVER COMPLETED!");
            setCurrentBowler(''); // Force change bowler
        }
        
        fetchMatchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const activeInningsScore = scores[2] && !scores[2].is_completed ? scores[2] : (scores[1] && !scores[1].is_completed ? scores[1] : (scores[2] || scores[1]));
  const activeInningsNum = activeInningsScore ? activeInningsScore.innings : 1;

  const outPlayers = useMemo(() => {
     if (!balls || !activeInningsScore) return [];
     return balls.filter(b => b.innings === activeInningsScore.innings && b.is_wicket && b.striker_name).map(b => b.striker_name);
  }, [balls, activeInningsScore]);

  useEffect(() => {
     if (currentStriker && outPlayers.includes(currentStriker)) {
        setCurrentStriker(''); // Force choose new batsman
     }
  }, [outPlayers, currentStriker]);

  const undoLastBall = async () => {
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]); // Distinct undo vibration pattern
    try {
      const res = await fetch(`${API_BASE}/matches/undo/${fixtureId}`, { 
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const result = await res.json();
      if (!res.ok) showError(result.error);
      else {
        showToast("↩️ BALL UNDONE");
        fetchMatchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8 text-center text-white">Loading...</div>;

  const isMatchComplete = fixture.status === 'completed';
  
  const getTeamName = (id) => id === teamA?.id ? teamA?.team_name : (id === teamB?.id ? teamB?.team_name : '');
  const battingTeamId = activeInningsScore?.team_id;
  const bowlingTeamId = battingTeamId === teamA?.id ? teamB?.id : teamA?.id;

  const battingTeam = battingTeamId === teamA?.id ? teamA : teamB;
  const bowlingTeam = bowlingTeamId === teamA?.id ? teamA : teamB;

  const battingPlayers = [battingTeam?.player1_name, battingTeam?.player2_name, battingTeam?.player3_name].filter(Boolean);
  const bowlingPlayers = [bowlingTeam?.player1_name, bowlingTeam?.player2_name, bowlingTeam?.player3_name].filter(Boolean);



  const formatOvers = (balls) => `${Math.floor(balls / 6)}.${balls % 6}`;

  const getMatchResult = () => {
     if (!scores[1] || !scores[2]) return null;
     const inn1 = scores[1];
     const inn2 = scores[2];
     const t1 = getTeamName(inn1.team_id);
     const t2 = getTeamName(inn2.team_id);
     
     if (inn1.runs > inn2.runs) return `${t1} won by ${inn1.runs - inn2.runs} runs! 🏆`;
     if (inn2.runs > inn1.runs) return `${t2} won the match! 🏆`;
     if (inn1.runs === inn2.runs) return "Match Tied! 🤝";
     return null;
  };

  const ScoreBtn = ({ label, action, styleClass = "bg-gray-800 text-white" }) => (
    <button disabled={isMatchComplete} onClick={action} className={`p-4 rounded-xl text-xl font-bold uppercase active:scale-95 transition-transform shadow-lg ${styleClass} ${isMatchComplete && 'opacity-50'}`}>{label}</button>
  );

  return (
    <div className="max-w-md mx-auto relative pb-20">
      {error && <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-600 text-white font-bold px-6 py-3 rounded-lg shadow-2xl z-50 animate-fade-in text-center border border-red-800 tracking-wider flex items-center justify-center gap-2 w-[90%] max-w-sm"><span>⚠️</span> {error}</div>}
      {toast && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-black font-black text-xl px-6 py-3 rounded-full shadow-2xl z-50 animate-bounce transition">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="bg-cricket-card p-4 rounded-t-xl border border-gray-800 border-b-0 shadow-lg mb-0 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cricket-accent to-cricket-lightGreen"></div>
        <h2 className="text-gray-400 uppercase text-xs font-bold tracking-widest mb-1">
          {isMatchComplete ? 'Match Completed' : `Innings ${activeInningsNum}`} • {fixture.total_overs} Overs Match
        </h2>
        <div className="flex justify-between items-center text-sm font-bold mt-2">
           <div className={`flex flex-col flex-1 items-center ${battingTeamId === teamA?.id ? 'text-white' : 'text-gray-500'}`}>
              <span className="truncate w-full uppercase">{teamA?.team_name}</span>
           </div>
           <div className="px-4 text-cricket-accent italic font-serif">vs</div>
           <div className={`flex flex-col flex-1 items-center ${battingTeamId === teamB?.id ? 'text-white' : 'text-gray-500'}`}>
              <span className="truncate w-full uppercase">{teamB?.team_name}</span>
           </div>
        </div>
      </div>

      {isMatchComplete ? (
        <div className="bg-cricket-card p-6 mb-6 rounded-b-xl border border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.15)] text-center animate-fade-in relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500"></div>
           <h2 className="text-3xl font-black text-yellow-500 uppercase tracking-widest mb-4 flex items-center justify-center gap-3">
             <Trophy className="w-10 h-10 drop-shadow-md" /> Summary
           </h2>
           <p className="text-xl font-bold text-white uppercase mb-8 bg-black/60 p-5 rounded-xl border border-gray-700 shadow-inner">
             {getMatchResult()}
           </p>
           
           <div className="flex justify-between items-center gap-4 text-left">
              <div className="flex-1 bg-gray-900/80 p-4 rounded-xl border border-gray-800">
                 <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2 truncate">{getTeamName(scores[1]?.team_id)}</p>
                 <p className="text-3xl font-black text-white">{scores[1]?.runs}<span className="text-lg font-bold text-gray-500">/{scores[1]?.wickets}</span></p>
                 <p className="text-xs text-gray-400 mt-1 font-bold">Overs: {formatOvers(scores[1]?.balls_bowled || 0)}</p>
              </div>
              <div className="text-gray-600 font-black italic text-sm">VS</div>
              <div className="flex-1 bg-gray-900/80 p-4 rounded-xl border border-gray-800">
                 <p className="text-[10px] text-cricket-lightGreen font-black uppercase tracking-widest mb-2 truncate">{getTeamName(scores[2]?.team_id)}</p>
                 <p className="text-3xl font-black text-white">{scores[2]?.runs}<span className="text-lg font-bold text-gray-500">/{scores[2]?.wickets}</span></p>
                 <p className="text-xs text-gray-400 mt-1 font-bold">Overs: {formatOvers(scores[2]?.balls_bowled || 0)}</p>
              </div>
           </div>

           <button onClick={() => navigate('/points')} className="mt-8 w-full bg-cricket-accent hover:bg-yellow-500 text-black font-black uppercase tracking-widest py-4 rounded-xl transition-all shadow-[0_0_15px_rgba(234,179,8,0.3)] hover:scale-105 focus:outline-none">
              View Points Table &gt;
           </button>
        </div>
      ) : (
        <>
          <div className="bg-black p-6 border border-gray-800 shadow-2xl rounded-b-none flex flex-col items-center justify-center mb-0">
             {activeInningsScore ? (
               <>
                  <div className="text-7xl font-black text-white tabular-nums tracking-tighter">
                    {activeInningsScore.runs}<span className="text-4xl text-gray-500">/{activeInningsScore.wickets}</span>
                  </div>
                  <div className="flex justify-between w-full mt-4 text-center border-t border-gray-800 pt-3">
                     <div className="flex-1">
                        <p className="text-gray-500 text-xs uppercase font-bold tracking-widest">Overs</p>
                        <p className="text-2xl font-bold text-cricket-accent">{formatOvers(activeInningsScore.balls_bowled)}</p>
                     </div>
                     <div className="flex-1 border-l border-gray-800">
                        <p className="text-gray-500 text-xs uppercase font-bold tracking-widest">Extras</p>
                        <p className="text-2xl font-bold text-white">{activeInningsScore.extras}</p>
                     </div>
                     {activeInningsScore.target && (
                       <div className="flex-1 border-l border-gray-800 bg-gray-900/50 rounded-r">
                          <p className="text-gray-400 text-xs uppercase font-bold tracking-widest">Target</p>
                          <p className="text-2xl font-bold text-yellow-400">{activeInningsScore.target}</p>
                       </div>
                     )}
                  </div>
                  
                  {activeInningsScore.target && !isMatchComplete && (() => {
                     const runsNeeded = activeInningsScore.target - activeInningsScore.runs;
                     const totalBalls = fixture.total_overs * 6;
                     const ballsLeft = totalBalls - activeInningsScore.balls_bowled;
                     const crr = activeInningsScore.balls_bowled > 0 ? ((activeInningsScore.runs / activeInningsScore.balls_bowled) * 6).toFixed(2) : "0.00";
                     const rrr = ballsLeft > 0 ? ((runsNeeded / ballsLeft) * 6).toFixed(2) : "N/A";
                     
                     return (
                        <div className="w-full mt-3 flex flex-col items-center">
                            <div className="w-full text-center text-[15px] text-yellow-400 font-black bg-yellow-900/20 border-t border-b border-yellow-800/50 py-2 uppercase tracking-wide">
                               Need {Math.max(0, runsNeeded)} runs in {Math.max(0, ballsLeft)} balls
                            </div>
                            <div className="flex gap-4 text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">
                               <span>CRR: {crr}</span>
                               <span className="text-gray-700">|</span>
                               <span>RRR: {rrr}</span>
                            </div>
                        </div>
                     );
                  })()}
               </>
             ) : (
               <div className="text-gray-500">No active innings</div>
             )}
          </div>

          <div className="bg-cricket-darker border-x border-b border-gray-800 p-4 mb-6 rounded-b-xl shadow-xl">
             <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                   <span className="text-cricket-lightGreen text-xl">🏏</span>
                   <select disabled={isMatchComplete} value={currentStriker} onChange={(e) => setCurrentStriker(e.target.value)} className={`bg-black border ${currentStriker ? 'border-gray-700' : 'border-red-500 ring-1 ring-red-500'} text-white rounded p-2 flex-1 focus:outline-none focus:border-cricket-lightGreen appearance-none`}>
                      <option value="" disabled>Select on Strike</option>
                      {battingPlayers.map(p => (
                          <option key={p} value={p} disabled={outPlayers.includes(p)} className={outPlayers.includes(p) ? 'text-gray-500 bg-gray-900 line-through' : ''}>
                             {p} {outPlayers.includes(p) ? '(OUT)' : ''}
                          </option>
                       ))}
                   </select>
                </div>
                <div className="flex items-center gap-2">
                   <span className="text-cricket-accent text-xl">⚾</span>
                   <select disabled={isMatchComplete} value={currentBowler} onChange={(e) => setCurrentBowler(e.target.value)} className={`bg-black border ${currentBowler ? 'border-gray-700' : 'border-red-500 ring-1 ring-red-500'} text-white rounded p-2 flex-1 focus:outline-none focus:border-cricket-accent appearance-none`}>
                      <option value="" disabled>Select Bowler</option>
                      {bowlingPlayers.map(p => <option key={p} value={p}>{p}</option>)}
                   </select>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {[0, 1, 2, 3, 4, 6].map(runs => (
               <ScoreBtn key={runs} label={`${runs}`} action={() => addBall({ runs_scored: runs })} styleClass={runs === 4 || runs === 6 ? "bg-blue-600 hover:bg-blue-500" : "bg-gray-800 hover:bg-gray-700"} />
            ))}
            <ScoreBtn label="WD" action={() => addBall({ is_wide: true, runs_scored: 0 })} styleClass="bg-orange-600 hover:bg-orange-500" />
            <ScoreBtn label="NB" action={() => addBall({ is_no_ball: true, runs_scored: 0 })} styleClass="bg-purple-600 hover:bg-purple-500" />
            <ScoreBtn label="WK" action={() => addBall({ is_wicket: true, runs_scored: 0 })} styleClass="bg-red-600 hover:bg-red-500 animate-pulse text-white font-black" />
          </div>

          <button disabled={isMatchComplete || balls.length === 0} onClick={undoLastBall} className="w-full bg-gray-600 hover:bg-gray-500 text-black py-4 rounded-xl text-xl font-bold uppercase disabled:opacity-30 tracking-widest flex items-center justify-center gap-2 mb-6">
            <span>↩️</span> Undo Last Ball
          </button>
        </>
      )}

      {/* Recent Balls Timeline */}
      <div className="bg-cricket-card p-4 rounded-xl border border-gray-800 mt-4 overflow-x-auto flex flex-col space-y-2">
         <div className="text-sm text-gray-400 font-bold uppercase tracking-widest pl-2">Recent Timeline</div>
         <div className="flex space-x-2 scrollbar-hide pb-2">
            {balls.slice(0, 15).map((b, i) => {
              let v = b.runs_scored.toString();
              let bg = 'bg-gray-700';
              if (b.is_wicket) { v = 'W'; bg = 'bg-red-600 font-bold text-white'; }
              else if (b.is_wide) { v = `WD`; bg = 'bg-orange-600 text-xs'; }
              else if (b.is_no_ball) { v = `NB`; bg = 'bg-purple-600 text-xs'; }
              else if (b.runs_scored === 4 || b.runs_scored === 6) { bg = 'bg-blue-600 font-bold'; }
              return (
                <div key={b.id} className="flex flex-col items-center">
                  <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white ${bg} ${i===0 ? 'ring-2 ring-cricket-accent ring-offset-2 ring-offset-black scale-110 ml-2' : ''}`}>
                    {v}
                  </div>
                  {i === 0 && <span className="text-[9px] text-gray-500 mt-2 uppercase font-bold text-center w-full truncate px-1">{b.striker_name}</span>}
                </div>
              );
            })}
         </div>
      </div>
    </div>
  );
}
