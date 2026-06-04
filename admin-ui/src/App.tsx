import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import Questions from './pages/Questions';
import Users from './pages/Users';
import Flags from './pages/Flags';
import Subscriptions from './pages/Subscriptions';
import AnalyticsPage from './pages/Analytics';
import Broadcast from './pages/Broadcast';
import { getFlags } from './api';

// ── Login page ──────────────────────────────────────────────────────────────
function LoginPage({ onLogin }: { onLogin: (secret: string) => void }) {
  const [value, setValue] = useState('');
  const navigate = useNavigate();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const s = value.trim();
    if (!s) return;
    localStorage.setItem('admin_secret', s);
    onLogin(s);
    navigate('/overview', { replace: true });
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-white font-bold font-display text-lg">
            E
          </div>
          <div>
            <h1 className="text-lg font-bold font-display text-white">ExamBuddi Admin</h1>
            <p className="text-xs text-muted">Enter your admin secret to continue</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-muted uppercase tracking-wider font-medium mb-2">
              Admin Secret
            </label>
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="sk-admin-..."
              autoFocus
              className="w-full bg-bg border border-border text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-accent placeholder-muted"
            />
          </div>
          <button
            type="submit"
            disabled={!value.trim()}
            className="w-full py-2.5 bg-accent text-white font-medium text-sm rounded-lg hover:bg-accent-dark transition-colors disabled:opacity-40"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Protected layout wrapper ────────────────────────────────────────────────
function ProtectedLayout({
  secret,
  pendingFlags,
  onLogout,
}: {
  secret: string;
  pendingFlags: number;
  onLogout: () => void;
}) {
  if (!secret) return <Navigate to="/login" replace />;
  return <Layout pendingFlags={pendingFlags} onLogout={onLogout} />;
}

// ── Root app ────────────────────────────────────────────────────────────────
export default function App() {
  const [secret, setSecret] = useState<string | null>(() => localStorage.getItem('admin_secret'));
  const [pendingFlags, setPendingFlags] = useState(0);

  const loadFlagCount = useCallback(async () => {
    try {
      const flags = await getFlags();
      setPendingFlags(flags.length);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    if (secret) {
      loadFlagCount();
      const interval = setInterval(loadFlagCount, 60_000);
      return () => clearInterval(interval);
    }
  }, [secret, loadFlagCount]);

  function handleLogout() {
    localStorage.removeItem('admin_secret');
    setSecret(null);
  }

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage onLogin={setSecret} />} />

      {/* Protected — nested under Layout */}
      <Route
        element={
          <ProtectedLayout
            secret={secret ?? ''}
            pendingFlags={pendingFlags}
            onLogout={handleLogout}
          />
        }
      >
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<Overview />} />
        <Route path="/questions" element={<Questions />} />
        <Route path="/users" element={<Users />} />
        <Route
          path="/flags"
          element={<Flags onFlagsResolved={loadFlagCount} />}
        />
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/broadcast" element={<Broadcast />} />
      </Route>

      {/* Fallback */}
      <Route
        path="*"
        element={<Navigate to={secret ? '/overview' : '/login'} replace />}
      />
    </Routes>
  );
}
