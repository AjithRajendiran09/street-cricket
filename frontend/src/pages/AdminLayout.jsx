import React, { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export default function AdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isAuthed, setIsAuthed] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) return navigate('/login');

        fetch(`${API_BASE}/auth/verify`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
            if (data.valid) setIsAuthed(true);
            else {
                localStorage.removeItem('adminToken');
                navigate('/login');
            }
        })
        .catch(() => navigate('/login'));
    }, [navigate]);

    const handleLogout = () => {
        const token = localStorage.getItem('adminToken');
        fetch(`${API_BASE}/auth/logout`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }});
        localStorage.removeItem('adminToken');
        navigate('/');
    };

    if (!isAuthed) return <div className="text-center p-8 font-mono text-gray-500 animate-pulse tracking-widest uppercase">Authenticating Identity...</div>;

    return (
        <div className="flex flex-col md:flex-row min-h-[85vh] border border-gray-800 rounded-xl overflow-hidden bg-black shadow-2xl relative">
            <div className="w-full md:w-64 bg-gray-900/80 flex flex-col border-r border-gray-800 backdrop-blur-xl z-10">
                <div className="p-6 border-b border-gray-800">
                   <h2 className="text-cricket-accent font-black uppercase tracking-widest flex items-center gap-2">
                       <span>⚙️</span> Control Panel
                   </h2>
                </div>
                <div className="flex flex-col space-y-1 p-4 flex-grow">
                    <Link to="/admin/leagues" className={`p-3 rounded uppercase font-black text-sm tracking-wider transition ${location.pathname.includes('/leagues') ? 'bg-cricket-lightGreen text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'text-gray-500 hover:bg-gray-800 hover:text-white'}`}>1. Leagues / Setup</Link>
                    <Link to="/admin/teams" className={`p-3 rounded uppercase font-black text-sm tracking-wider transition ${location.pathname.includes('/teams') ? 'bg-cricket-lightGreen text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'text-gray-500 hover:bg-gray-800 hover:text-white'}`}>2. Roster Editor</Link>
                    <Link to="/admin/fixtures" className={`p-3 rounded uppercase font-black text-sm tracking-wider transition ${location.pathname.includes('/fixtures') ? 'bg-cricket-lightGreen text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'text-gray-500 hover:bg-gray-800 hover:text-white'}`}>3. Match Engine</Link>
                </div>
                <div className="p-4 border-t border-gray-800 bg-black/50">
                   <button onClick={handleLogout} className="w-full p-3 bg-red-900/30 text-red-500 hover:bg-red-600 hover:text-white font-bold uppercase tracking-widest rounded transition text-xs">Terminate Session</button>
                </div>
            </div>
            <div className="flex-1 bg-cricket-dark p-2 sm:p-8 overflow-y-auto max-h-[85vh]">
                <Outlet />
            </div>
        </div>
    );
}
