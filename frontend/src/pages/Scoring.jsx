import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Trophy } from 'lucide-react';
import LivePlayerStats from '../components/LivePlayerStats';
import FullScorecard from '../components/FullScorecard';

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
  const [shake, setShake] = useState(false);

  // Player Tracking
  const [currentStriker, setCurrentStriker] = useState('');
  const [currentBowler, setCurrentBowler] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };
  const [error, setError] = useState(null);
  const showError = (msg) => { setError(msg); setTimeout(() => setError(null), 4000); };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const playAudioSfx = (type) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'bat') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
        gain.gain.setValueAtTime(1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'wicket') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
        gain.gain.setValueAtTime(1, now);

        // Tremolo for shattering sound
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 20;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.5;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        lfo.start(now);
        lfo.stop(now + 0.4);

        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch (e) {
      console.log(e);
    }
  };

  const speakAction = (text, priority = false) => {
    if ('speechSynthesis' in window) {
      if (priority) window.speechSynthesis.cancel();
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.pitch = 1.1;
        utterance.rate = priority ? 1.0 : 1.1;
        window.speechSynthesis.speak(utterance);
      }, priority ? 50 : 10);
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
        setBalls(data.ball_by_ball.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
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

    let prefixSpeech = "";
    const activeForSpeech = scores[2] && !scores[2].is_completed ? scores[2] : (scores[1] && !scores[1].is_completed ? scores[1] : (scores[2] || scores[1]));
    if (activeForSpeech && activeForSpeech.balls_bowled % 6 === 0) {
      prefixSpeech = `${currentBowler} to ${currentStriker}. `;
      if (activeForSpeech.innings === 2 && activeForSpeech.balls_bowled === 0 && scores[1]) {
        prefixSpeech += `Target is ${scores[1].runs + 1}. `;
      }
    }

    if (payload.is_wicket) {
      playAudioSfx('wicket');
      speakAction(prefixSpeech + "Out! What a Wicket ooostt!");
    } else if (payload.is_wide) {
      speakAction(prefixSpeech + "Wide Ball!");
    } else if (payload.is_no_ball) {
      speakAction(prefixSpeech + "No Ball! Free Hit!");
    } else if (payload.runs_scored === 0) {
      const phrases = ["Chocolate coffee!", "Gowdru kabab!", "VCC kabab!", "Reddy biryani!", "Reddy porota!", "Attibele Anarkali!", "Ramakrishna paniyaram!", "Meghana's Kushka!"];
      speakAction(prefixSpeech + phrases[Math.floor(Math.random() * phrases.length)]);
    } else if (payload.runs_scored === 1) {
      speakAction(prefixSpeech + "Single Taken");
    } else if (payload.runs_scored === 2) {
      speakAction(prefixSpeech + "Two runs!");
    } else if (payload.runs_scored === 3) {
      speakAction(prefixSpeech + "Three runs! Great running!");
    } else if (payload.runs_scored === 4) {
      playAudioSfx('bat');
      triggerShake();
      speakAction(prefixSpeech + "Four runs! Superb Boundary!");
    } else if (payload.runs_scored === 6) {
      playAudioSfx('bat');
      triggerShake();
      speakAction(prefixSpeech + "Six runs! Absolute Maximum!");
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

        if (result.updatedScore.is_completed) {
          setTimeout(() => showToast("🏁 INNINGS COMPLETED!"), payload.is_wicket ? 1500 : 0);
          setCurrentStriker(''); // Clear for next innings
          setCurrentBowler(''); // Clear for next innings

          if (result.updatedScore.innings === 2) {
            const inn1 = scores[1];
            if (inn1) {
              const inn1runs = inn1.runs;
              const inn2runs = result.updatedScore.runs;
              const t1 = teamA?.id === inn1.team_id ? teamA?.team_name : teamB?.team_name;
              const t2 = teamA?.id === result.updatedScore.team_id ? teamA?.team_name : teamB?.team_name;

              let finalString = "Match tied.";
              if (inn1runs > inn2runs) finalString = `${t1} won by ${inn1runs - inn2runs} runs.`;
              else if (inn2runs > inn1runs) finalString = `${t2} won the match.`;

              // priority=true forcibly overrides iOS Safari queue silencing bugs!
              speakAction(`Match Completed. ${finalString}`, true);
            }
          } else {
            const targetRuns = result.updatedScore.runs + 1;
            speakAction(`First Innings Completed! The target is ${targetRuns} runs.`, true);
          }
        }
        else if (result.updatedScore.balls_bowled > 0 && result.updatedScore.balls_bowled % 6 === 0) {
          setTimeout(() => showToast("🏏 OVER COMPLETED!"), payload.is_wicket ? 1500 : 0);
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
  const calculatedTarget = activeInningsScore?.innings === 2 && scores[1] ? scores[1].runs + 1 : null;

  const calculateWinProbability = () => {
    try {
      if (activeInningsNum !== 2 || !calculatedTarget || isMatchComplete || !activeInningsScore) return null;
      const runsNeeded = calculatedTarget - (activeInningsScore.runs || 0);
      const totalBalls = (fixture?.total_overs || 2) * 6;
      const ballsLeft = totalBalls - (activeInningsScore.balls_bowled || 0);

      if (runsNeeded <= 0) return 100;
      if (ballsLeft <= 0) return 0;

      const crr = activeInningsScore.balls_bowled > 0 ? (activeInningsScore.runs / activeInningsScore.balls_bowled) * 6 : ((calculatedTarget - 1) / totalBalls) * 6;
      const rrr = (runsNeeded / ballsLeft) * 6;

      let prob = 50 + (crr - rrr) * 8;
      prob -= ((activeInningsScore.wickets || 0) * 6);
      return Math.round(Math.max(5, Math.min(95, prob || 50)));
    } catch {
      return 50;
    }
  };
  const battingProb = calculateWinProbability();

  // Clear selections when innings change (e.g., across refreshes or incoming real-time updates)
  useEffect(() => {
    setCurrentStriker('');
    setCurrentBowler('');
  }, [activeInningsNum]);

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

  const getMVP = () => {
    if (!isMatchComplete || !balls || balls.length === 0) return null;
    const playerPoints = {};

    balls.forEach(b => {
      if (b.striker_name && !b.is_wide) {
        if (!playerPoints[b.striker_name]) playerPoints[b.striker_name] = 0;
        playerPoints[b.striker_name] += (b.runs_scored || 0); // 1 pt per run
        if (b.runs_scored === 4) playerPoints[b.striker_name] += 1; // Bonus
        if (b.runs_scored === 6) playerPoints[b.striker_name] += 2; // Bonus
      }
      if (b.bowler_name) {
        if (!playerPoints[b.bowler_name]) playerPoints[b.bowler_name] = 0;
        if (b.is_wicket && !['run_out', 'retired_hurt'].includes(b.wicket_type)) {
          playerPoints[b.bowler_name] += 15; // 15 pts per wicket
        }
        if ((b.runs_scored || 0) === 0 && !b.is_wide && !b.is_no_ball && (b.extras || 0) === 0 && !b.is_wicket) {
          playerPoints[b.bowler_name] += 1; // 1 pt per dot ball
        }
      }
    });
    const mvp = Object.entries(playerPoints).sort((a, b) => b[1] - a[1])[0];
    return mvp ? mvp[0] : null;
  };

  const mvpPlayer = getMVP();

  const generateWhatsAppShare = () => {
    const matchRes = getMatchResult();
    const mvpStr = mvpPlayer ? `\n🌟 *Player of the Match:* ${mvpPlayer}` : '';
    const t1Name = getTeamName(scores[1]?.team_id) || 'Team 1';
    const t2Name = getTeamName(scores[2]?.team_id) || 'Team 2';

    const s1 = scores[1] ? `🏏 *${t1Name}*: ${scores[1].runs}/${scores[1].wickets} (${formatOvers(scores[1].balls_bowled)} ov)` : '';
    const s2 = scores[2] ? `🏏 *${t2Name}*: ${scores[2].runs}/${scores[2].wickets} (${formatOvers(scores[2].balls_bowled)} ov)` : '';

    const text = `🏆 *STREET CRICKET RESULTS* 🏆\n\n${s1}\n${s2}\n\n🔥 *${matchRes?.replace('🏆', '') || ''}*${mvpStr}\n\nFollow live leaderboard on the App!`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const ScoreBtn = ({ label, action, styleClass = "bg-gray-800 text-white" }) => (
    <button disabled={isMatchComplete} onClick={action} className={`p-4 rounded-xl text-xl font-bold uppercase active:scale-95 transition-transform shadow-lg ${styleClass} ${isMatchComplete && 'opacity-50'}`}>{label}</button>
  );

  return (
    <div className={`max-w-md mx-auto relative pb-20 ${shake ? 'animate-shake' : ''}`}>
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
          <p id="match-result-string" className="text-xl font-bold text-white uppercase mb-8 bg-black/60 p-5 rounded-xl border border-gray-700 shadow-inner tracking-widest flex flex-col items-center justify-center">
            {getMatchResult()}
            {fixture.match_type === 'Final' && (
              <span className="mt-4 text-sm bg-yellow-900 border border-yellow-500 text-yellow-400 px-4 py-2 rounded-lg animate-pulse flex items-center justify-center font-black">
                🌟 TOURNAMENT CHAMPIONS 🌟
              </span>
            )}
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

          <FullScorecard
            fixture={fixture}
            balls={balls}
            scores={scores}
            teamA={teamA}
            teamB={teamB}
            mvpPlayer={mvpPlayer}
          />

          <button onClick={generateWhatsAppShare} className="mt-8 w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-black uppercase tracking-widest py-4 rounded-xl transition-all shadow-[0_0_15px_rgba(37,211,102,0.4)] hover:scale-105 flex items-center justify-center gap-2 focus:outline-none">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" /></svg>
            Share to WhatsApp
          </button>

          <button onClick={() => navigate('/points')} className="mt-4 w-full bg-cricket-accent hover:bg-yellow-500 text-black font-black uppercase tracking-widest py-4 rounded-xl transition-all shadow-[0_0_15px_rgba(234,179,8,0.3)] hover:scale-105 focus:outline-none">
            View Points Table &gt;
          </button>

          {balls.length > 0 && (
            <button onClick={undoLastBall} className="mt-4 w-full bg-red-900 border border-red-500 hover:bg-red-800 text-white py-4 rounded-xl text-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition shadow-xl mt-6">
              <span>⚠️</span> Undo to Resume Match
            </button>
          )}
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
                  {calculatedTarget && (
                    <div className="flex-1 border-l border-gray-800 bg-gray-900/50 rounded-r">
                      <p className="text-gray-400 text-xs uppercase font-bold tracking-widest">Target</p>
                      <p className="text-2xl font-bold text-yellow-400">{calculatedTarget}</p>
                    </div>
                  )}
                </div>

                {calculatedTarget && !isMatchComplete && (() => {
                  const runsNeeded = calculatedTarget - activeInningsScore.runs;
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

                {battingProb !== null && (
                  <div className="w-full mt-4 px-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1">
                      <span className="text-gray-400 truncate flex-1">{getTeamName(scores[1].team_id)} <span className="text-white">{100 - battingProb}%</span></span>
                      <span className="text-yellow-400 truncate flex-1 text-right"><span className="text-white">{battingProb}%</span> {getTeamName(scores[2].team_id)}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden flex shadow-inner">
                      <div className="h-full bg-gray-600 transition-all duration-1000 ease-out border-r border-gray-900" style={{ width: `${100 - battingProb}%` }}></div>
                      <div className="h-full bg-yellow-500 transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(234,179,8,1)] relative" style={{ width: `${battingProb}%` }}>
                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                      </div>
                    </div>
                    <div className="text-[8px] text-center text-gray-600 uppercase tracking-widest mt-1">Live Win Predictor</div>
                  </div>
                )}

                <LivePlayerStats
                  balls={balls}
                  activeInningsNum={activeInningsNum}
                  currentStriker={currentStriker}
                  currentBowler={currentBowler}
                />
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
                <select disabled={isMatchComplete || (activeInningsScore && activeInningsScore.balls_bowled > 0 && activeInningsScore.balls_bowled % 6 !== 0)} value={currentBowler} onChange={(e) => setCurrentBowler(e.target.value)} className={`bg-black border ${currentBowler ? 'border-gray-700' : 'border-red-500 ring-1 ring-red-500'} text-white rounded p-2 flex-1 focus:outline-none focus:border-cricket-accent appearance-none disabled:opacity-50`}>
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
                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white ${bg} ${i === 0 ? 'ring-2 ring-cricket-accent ring-offset-2 ring-offset-black scale-110 ml-2' : ''}`}>
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
