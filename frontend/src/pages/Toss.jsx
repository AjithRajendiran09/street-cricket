import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export default function Toss() {
  const { fixtureId } = useParams();
  const navigate = useNavigate();
  const [fixture, setFixture] = useState(null);
  
  // Toss steps: 'selection' -> 'flipping' -> 'decision' -> 'completed'
  const [step, setStep] = useState('selection'); 
  const [calledSide, setCalledSide] = useState('heads');
  const [coinResult, setCoinResult] = useState(null);
  const [tossWinnerId, setTossWinnerId] = useState(null);
  const [tossResult, setTossResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const showError = (msg) => { setError(msg); setTimeout(() => setError(null), 4000); };

  useEffect(() => {
    fetch(`${API_BASE}/tournament/fixtures/${fixtureId}`)
      .then(res => res.json())
      .then(data => {
        setFixture(data);
        if (data.status === 'toss') {
          // Already tossed completely
          setTossResult({ winnerId: data.toss_winner_id, decision: data.toss_decision });
          setStep('completed');
        } else if (data.status === 'live' || data.status === 'completed') {
          // Prevent ghost-tosses if user navigated back via browser history
          navigate(`/scoring/${fixtureId}`);
        }
      })
      .catch(err => console.error(err));
  }, [fixtureId]);

  const executeCoinFlip = () => {
    setStep('flipping');
    setTimeout(() => {
      // Logic for random toss result
      const isHeads = Math.random() < 0.5;
      const actualLanded = isHeads ? 'heads' : 'tails';
      setCoinResult(actualLanded);
      
      const callerWon = calledSide === actualLanded;
      const winner = callerWon ? fixture.team_a_id : fixture.team_b_id;
      setTossWinnerId(winner);
      setStep('decision');
    }, 2000); // 2 second flip animation
  };

  const submitTossDecision = async (decision) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/matches/toss/${fixtureId}`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({ tossWinnerId, tossDecision: decision })
      });
      const data = await res.json();
      if (res.ok) {
        setTossResult({ winnerId: data.toss_winner_id, decision: data.toss_decision });
        setFixture(data);
        setStep('completed');
      } else {
        showError("Error: " + data.error);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const startMatch = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/matches/start/${fixtureId}`, { 
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      if (res.ok) {
        navigate(`/scoring/${fixtureId}`);
      } else {
        const err = await res.json();
        showError("Error: " + err.error);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  if (!fixture) return <div className="p-8 text-center text-white">Loading fixture...</div>;

  const getTeamName = (id) => {
    if (fixture.team_a?.id === id) return fixture.team_a.team_name;
    if (fixture.team_b?.id === id) return fixture.team_b.team_name;
    return "The winning team";
  };

  return (
    <div className="flex justify-center items-center min-h-[70vh]">
      {error && <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-600 text-white font-bold px-6 py-3 rounded-lg shadow-2xl z-50 animate-fade-in text-center border border-red-800 tracking-wider flex items-center justify-center gap-2 w-[90%] max-w-sm"><span>⚠️</span> {error}</div>}
      <div className="bg-cricket-card p-6 rounded-xl border border-gray-800 shadow-2xl space-y-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-cricket-accent uppercase tracking-wider">Match Toss</h1>
        
        <div className="flex justify-between items-center bg-black p-4 rounded-lg font-bold text-lg text-white text-center uppercase shadow-inner">
          <div className="w-1/2 break-words p-2 border-r border-gray-700">{fixture.team_a?.team_name || 'Team A'}</div>
          <div className="w-1/2 break-words p-2">{fixture.team_b?.team_name || 'Team B'}</div>
        </div>

        {step === 'selection' && (
          <div className="space-y-6 animate-fade-in text-center">
            <p className="text-gray-400 mb-2 uppercase text-sm font-bold tracking-wider">
               <span className="text-white">{fixture.team_a?.team_name}</span> calls:
            </p>
            <div className="flex justify-center gap-4">
              <button onClick={() => setCalledSide('heads')} className={`px-6 py-3 rounded-lg font-bold uppercase w-1/2 transition ${calledSide === 'heads' ? 'bg-cricket-lightGreen text-white shadow-[0_0_15px_rgba(34,197,94,0.4)] scale-105' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>HEADS</button>
              <button onClick={() => setCalledSide('tails')} className={`px-6 py-3 rounded-lg font-bold uppercase w-1/2 transition ${calledSide === 'tails' ? 'bg-cricket-lightGreen text-white shadow-[0_0_15px_rgba(34,197,94,0.4)] scale-105' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>TAILS</button>
            </div>
            <button disabled={loading} onClick={executeCoinFlip} className="w-full mt-4 py-4 text-xl font-bold rounded-lg uppercase tracking-widest text-black bg-cricket-accent hover:bg-yellow-500 hover:scale-[1.02] transition-all shadow-[0_0_15px_rgba(234,179,8,0.3)] focus:outline-none">Flip Coin</button>
          </div>
        )}

        {step === 'flipping' && (
          <div className="flex flex-col items-center justify-center space-y-6 py-8">
            <div className="relative w-32 h-32 transform-gpu" style={{ animation: 'spin 0.5s linear infinite' }}>
               <style>{`
                 @keyframes spin {
                   0% { transform: rotateY(0deg) scale(1); }
                   50% { transform: rotateY(180deg) scale(1.2); }
                   100% { transform: rotateY(360deg) scale(1); }
                 }
               `}</style>
               <div className="absolute inset-0 bg-gradient-to-br from-yellow-300 to-yellow-600 rounded-full border-4 border-yellow-700 flex items-center justify-center shadow-[0_0_30px_rgba(234,179,8,0.5)]">
                 <span className="text-yellow-900 font-bold text-5xl">🪙</span>
               </div>
            </div>
            <p className="text-cricket-accent animate-pulse font-bold tracking-widest uppercase text-lg">Flipping in the air...</p>
          </div>
        )}

        {step === 'decision' && (
           <div className="space-y-6 animate-fade-in text-center p-4">
             <div className="inline-block px-10 py-6 rounded-3xl bg-black border-2 border-yellow-600 mb-2 shadow-[0_0_20px_rgba(202,138,4,0.3)] transform hover:scale-105 transition">
                 <span className="text-3xl text-cricket-accent font-black uppercase tracking-widest block mb-1">It's {coinResult}!</span>
                 <span className="text-gray-400 text-xs tracking-widest uppercase font-bold">Coin Result</span>
             </div>
             
             <h2 className="text-4xl font-black text-white uppercase break-words mt-4">{getTeamName(tossWinnerId)}</h2>
             <p className="text-cricket-lightGreen text-xl uppercase font-bold tracking-widest mt-1">Won the Toss!</p>
             <p className="text-gray-400 mt-6 mb-2 uppercase text-sm tracking-wider">What will they choose?</p>
             
             <div className="flex justify-center gap-4 mt-4">
               <button onClick={() => submitTossDecision('bat')} disabled={loading} className="px-6 py-5 w-1/2 rounded-lg font-bold uppercase tracking-widest bg-cricket-lightGreen text-white hover:bg-cricket-green hover:scale-105 transition-all shadow-lg focus:outline-none">BAT</button>
               <button onClick={() => submitTossDecision('bowl')} disabled={loading} className="px-6 py-5 w-1/2 rounded-lg font-bold uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 transition-all shadow-lg focus:outline-none">BOWL</button>
             </div>
           </div>
        )}

        {step === 'completed' && tossResult && (
          <div className="space-y-6 animate-fade-in text-center p-6 bg-black/40 border border-gray-700/50 flex flex-col items-center rounded-xl shadow-inner">
             <div className="text-5xl drop-shadow-lg mb-2">🏆</div>
             <h2 className="text-2xl font-black text-white uppercase text-center">{getTeamName(tossResult.winnerId)}</h2>
             <p className="text-gray-400 text-sm uppercase font-bold tracking-widest mt-2 block">won the toss & chose to</p>
             <p className="text-4xl font-black text-cricket-accent uppercase border-b-4 border-cricket-accent/50 inline-block pb-2 mt-3">{tossResult.decision}</p>
             
             {fixture?.status === 'toss' && (
                 <button onClick={startMatch} disabled={loading} className="block w-full mt-8 py-4 bg-cricket-green hover:bg-green-700 text-white font-bold text-lg uppercase tracking-widest rounded transition disabled:opacity-50 shadow-[0_4px_15px_rgba(34,197,94,0.3)] focus:outline-none focus:ring-2 focus:ring-green-400">START MATCH &gt;</button>
             )}
          </div>
        )}
      </div>
    </div>
  );
}
