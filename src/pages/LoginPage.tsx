import React, { useState } from 'react';
import { api } from '../api/client';
import { UserSession } from '../types';

interface LoginPageProps {
  onLoginSuccess: (user: UserSession) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.login(username, password);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] flex flex-col items-center justify-center p-6 selection:bg-[#C6A46A]/20">
      <div className="w-full max-w-sm bg-white border border-[#E8E4DC] p-8 sm:p-10 shadow-sm text-center">
        {/* Brand Header */}
        <div className="mb-8">
          <h1 className="font-serif-luxury text-3xl font-bold tracking-widest text-[#111111] uppercase">
            AEVY
          </h1>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#888888] mt-1">
            Essence of Fresh Elegance
          </p>
          <div className="w-8 h-px bg-[#C6A46A] mx-auto mt-4" />
        </div>

        <div className="text-left mb-6">
          <h2 className="text-sm font-semibold text-[#111111] tracking-tight">
            Admin Sign In
          </h2>
          <p className="text-xs text-[#888888] mt-0.5">
            Access your dynamic QR codes and scan analytics.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs text-left">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[#666666] font-medium mb-1.5">
              Username or Email
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[#666666] font-medium mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 text-xs font-medium text-white bg-[#111111] hover:bg-[#C6A46A] transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? 'Authenticating...' : 'Enter QR Studio'}
          </button>
        </form>

        {/* Default credentials hint */}
        <div className="mt-8 pt-6 border-t border-[#F0ECE4] text-left text-[11px] text-[#888888] space-y-1">
          <div className="font-medium text-[#555555]">Default Admin Credentials:</div>
          <div className="font-mono-tabular">User: <span className="text-[#111111]">admin</span></div>
          <div className="font-mono-tabular">Pass: <span className="text-[#111111]">aevy2026!</span></div>
          <div className="text-[10px] text-[#999999] pt-1">You can change this password at any time in Settings.</div>
        </div>
      </div>

      <div className="mt-6 text-[11px] text-[#888888]">
        AEVY Fragrance · Packaging QR Telemetry System
      </div>
    </div>
  );
};
