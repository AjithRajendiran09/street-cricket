import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Swords, CircleDot } from 'lucide-react';

const formats = [
  {
    key: 'league',
    icon: <Trophy className="w-12 h-12" />,
    emoji: '🏆',
    title: 'League Street Cricket',
    subtitle: 'Round-Robin Tournament',
    description: 'All teams play each other. Points table decides playoffs. Classic street cricket format with 2-3 players per team.',
    gradient: 'from-green-900 to-green-700',
    border: 'border-green-600',
    glow: 'shadow-[0_0_40px_rgba(34,197,94,0.2)]',
    hoverGlow: 'hover:shadow-[0_0_60px_rgba(34,197,94,0.35)]',
    accent: 'text-green-400',
    bg: 'bg-green-500',
    features: ['Round-Robin Fixtures', 'Points Table & NRR', 'Playoffs & Final', '2-3 Players/Team']
  },
  {
    key: 'knockout',
    icon: <Swords className="w-12 h-12" />,
    emoji: '⚔️',
    title: 'Knockout Tournament',
    subtitle: 'Single Elimination Bracket',
    description: 'Win or go home. Bracket-based elimination from Quarter-Finals to the Grand Final. Automatic byes for uneven teams.',
    gradient: 'from-orange-900 to-red-800',
    border: 'border-orange-500',
    glow: 'shadow-[0_0_40px_rgba(249,115,22,0.2)]',
    hoverGlow: 'hover:shadow-[0_0_60px_rgba(249,115,22,0.35)]',
    accent: 'text-orange-400',
    bg: 'bg-orange-500',
    features: ['Auto Bracket Generation', 'QF → SF → Final', 'Byes for Uneven Teams', '2-3 Players/Team']
  },
  {
    key: 'test',
    icon: <CircleDot className="w-12 h-12" />,
    emoji: '🏏',
    title: 'Test Match',
    subtitle: '4-Innings Classic',
    description: 'The ultimate cricket experience. Declarations, follow-on enforcement, and draws. Supports larger teams of 5-6 players.',
    gradient: 'from-blue-900 to-indigo-800',
    border: 'border-blue-500',
    glow: 'shadow-[0_0_40px_rgba(59,130,246,0.2)]',
    hoverGlow: 'hover:shadow-[0_0_60px_rgba(59,130,246,0.35)]',
    accent: 'text-blue-400',
    bg: 'bg-blue-500',
    features: ['4 Innings Per Match', 'Declare & Follow-On', 'Draws & Ties', '5-6 Players/Team']
  }
];

export default function FormatSelector() {
  const navigate = useNavigate();

  const selectFormat = (format) => {
    localStorage.setItem('active_format', format);
    navigate('/dashboard');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-10">
      {/* Hero */}
      <div className="text-center space-y-4 mb-12 relative">
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-cricket-accent rounded-full blur-[100px] opacity-15 pointer-events-none"></div>
        <h1 className="text-5xl md:text-7xl font-black text-white uppercase tracking-tighter drop-shadow-2xl">
          <span className="text-cricket-accent">Hurricane</span> Cricket
        </h1>
        <p className="text-gray-400 text-sm md:text-base uppercase tracking-[0.3em] font-bold">
          Choose Your Battle Format
        </p>
        <div className="w-24 h-1 bg-gradient-to-r from-cricket-accent to-cricket-lightGreen mx-auto rounded-full"></div>
      </div>

      {/* Format Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
        {formats.map((f, i) => (
          <button
            key={f.key}
            onClick={() => selectFormat(f.key)}
            className={`group relative bg-gradient-to-b ${f.gradient} rounded-2xl border ${f.border} p-6 text-left transition-all duration-300 hover:scale-[1.03] ${f.glow} ${f.hoverGlow} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black overflow-hidden`}
            style={{ animationDelay: `${i * 100}ms` }}
          >
            {/* Decorative corner accent */}
            <div className={`absolute top-0 right-0 w-24 h-24 ${f.bg} opacity-10 rounded-bl-full`}></div>
            <div className="absolute bottom-0 left-0 w-16 h-16 bg-white opacity-[0.03] rounded-tr-full"></div>

            {/* Icon + Title */}
            <div className="flex items-center gap-3 mb-4">
              <div className={`${f.accent} group-hover:scale-110 transition-transform`}>
                {f.icon}
              </div>
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-wide leading-tight">
                  {f.title}
                </h2>
                <p className={`text-xs font-bold uppercase tracking-widest ${f.accent} mt-0.5`}>
                  {f.subtitle}
                </p>
              </div>
            </div>

            {/* Description */}
            <p className="text-gray-300 text-sm leading-relaxed mb-5">
              {f.description}
            </p>

            {/* Feature Tags */}
            <div className="flex flex-wrap gap-2 mb-5">
              {f.features.map((feat) => (
                <span
                  key={feat}
                  className="text-[10px] font-bold uppercase tracking-wider bg-black/40 text-gray-300 px-2.5 py-1 rounded-full border border-white/10"
                >
                  {feat}
                </span>
              ))}
            </div>

            {/* CTA */}
            <div className={`w-full py-3 rounded-xl ${f.bg} bg-opacity-20 border border-white/10 text-center font-black uppercase tracking-widest text-sm text-white group-hover:bg-opacity-30 transition`}>
              Select {f.emoji}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
