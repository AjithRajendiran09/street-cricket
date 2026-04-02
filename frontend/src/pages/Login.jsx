import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('adminToken', data.token);
                navigate('/admin/leagues');
            } else {
                alert(data.error);
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[70vh]">
            <form onSubmit={handleLogin} className="bg-cricket-card p-8 rounded-xl border border-gray-800 shadow-[0_0_50px_rgba(234,179,8,0.1)] space-y-6 w-full max-w-sm">
                <h1 className="text-3xl font-black text-cricket-accent uppercase tracking-widest text-center flex flex-col items-center gap-2">
                   <span>🛡️</span> Admin Access
                </h1>
                <input type="text" placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} className="w-full bg-black border border-gray-700 text-white p-4 rounded focus:border-cricket-accent focus:outline-none transition" />
                <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-black border border-gray-700 text-white p-4 rounded focus:border-cricket-accent focus:outline-none transition" />
                <button type="submit" className="w-full bg-cricket-green text-white font-black text-lg uppercase tracking-widest py-4 rounded hover:bg-green-700 transition shadow-[0_0_15px_rgba(34,197,94,0.3)]">Authenticate</button>
            </form>
        </div>
    );
}
