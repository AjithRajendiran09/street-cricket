import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Teams from './pages/Teams';
import Fixtures from './pages/Fixtures';
import Toss from './pages/Toss';
import Scoring from './pages/Scoring';
import Watch from './pages/Watch';
import Points from './pages/Points';
import History from './pages/History';
import Leaderboard from './pages/Leaderboard';
import Login from './pages/Login';
import AdminLayout from './pages/AdminLayout';
import { Trophy, Users, Calendar, BarChart2, Clock, Play, ShieldAlert } from 'lucide-react';

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-cricket-dark pb-20 sm:pb-0">
        <header className="bg-cricket-green text-white p-4 shadow-lg sticky top-0 z-50">
          <div className="container mx-auto flex justify-between items-center">
            <Link to="/" className="text-xl font-black flex items-center gap-2 tracking-tighter uppercase">
              <span className="text-cricket-accent text-2xl animate-pulse">🌪️</span> Hurricane Street Cricket
            </Link>
            <div className="hidden sm:flex space-x-6 overflow-x-auto whitespace-nowrap text-sm font-medium text-gray-200 uppercase tracking-wide">
               <Link to="/teams" className="hover:text-white transition">Teams</Link>
               <Link to="/fixtures" className="hover:text-white transition">Fixtures</Link>
               <Link to="/points" className="hover:text-white transition">Points Table</Link>
               <Link to="/history" className="hover:text-white transition">History</Link>
               <Link to="/leaderboard" className="hover:text-white transition">Leaders</Link>
               <Link to="/admin/leagues" className="hover:text-cricket-accent transition font-bold text-yellow-500 border border-yellow-500/50 px-2 rounded flex items-center gap-1 mx-2 focus:outline-none">🔒 ADMIN</Link>
            </div>
          </div>
        </header>
        
        <main className="flex-grow container mx-auto p-4 animate-fade-in pb-10">
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Admin Protected Architecture */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route path="leagues" element={<Home isAdminMode={true} />} />
              <Route path="teams" element={<Teams />} />
              <Route path="fixtures" element={<Fixtures isAdminMode={true} />} />
              <Route path="toss/:fixtureId" element={<Toss />} />
              <Route path="scoring/:fixtureId" element={<Scoring />} />
            </Route>

            {/* Public Viewing Read-Only */}
            <Route path="/" element={<Home isAdminMode={false} />} />
            <Route path="/fixtures" element={<Fixtures isAdminMode={false} />} />
            <Route path="/watch/:fixtureId" element={<Watch />} />
            <Route path="/points" element={<Points />} />
            <Route path="/history" element={<History />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
          </Routes>
        </main>

        <footer className="w-full text-center py-6 border-t border-gray-800 bg-black mt-auto pb-24 sm:pb-6 z-10 relative">
           <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">
              Developed by <span className="text-cricket-lightGreen ml-1 text-sm tracking-widest drop-shadow-[0_0_10px_rgba(34,197,94,0.8)] font-black">Ajith Rajendiran</span>
           </p>
        </footer>

        {/* Mobile Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 bg-cricket-card border-t border-gray-800 sm:hidden z-50 flex justify-around py-2">
          <Link to="/" className="flex flex-col items-center p-2 text-gray-400 hover:text-cricket-accent transition">
            <Play size={20} />
            <span className="text-[10px] mt-1 uppercase">Live</span>
          </Link>
          <Link to="/teams" className="flex flex-col items-center p-2 text-gray-400 hover:text-cricket-accent transition">
            <Users size={20} />
            <span className="text-[10px] mt-1 uppercase">Teams</span>
          </Link>
          <Link to="/fixtures" className="flex flex-col items-center p-2 text-gray-400 hover:text-cricket-accent transition">
            <Calendar size={20} />
            <span className="text-[10px] mt-1 uppercase">Fixtures</span>
          </Link>
          <Link to="/points" className="flex flex-col items-center p-2 text-gray-400 hover:text-cricket-accent transition">
            <Trophy size={20} />
            <span className="text-[10px] mt-1 uppercase">Points</span>
          </Link>
          <Link to="/history" className="flex flex-col items-center p-2 text-gray-400 hover:text-cricket-accent transition">
            <Clock size={20} />
            <span className="text-[10px] mt-1 uppercase">History</span>
          </Link>
          <Link to="/leaderboard" className="flex flex-col items-center p-2 text-gray-400 hover:text-cricket-accent transition">
            <BarChart2 size={20} />
            <span className="text-[10px] mt-1 uppercase">Leaders</span>
          </Link>
        </nav>
      </div>
    </Router>
  );
}

export default App;
