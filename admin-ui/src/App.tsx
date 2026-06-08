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
import { getFlags, loginAdmin } from './api';

// ── Login page ──────────────────────────────────────────────────────────────
function LoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setError('');
    setLoading(true);
    try {
      const { token } = await loginAdmin(username.trim(), password.trim());
      localStorage.setItem('admin_token', token);
      onLogin(token);
      navigate('/overview', { replace: true });
    } catch {
      setError('Invalid username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-white font-bold font-display text-lg">
            E
          </div>
          <div>
            <h1 className="text-lg font-bold font-display text-white">ExamBuddie Admin</h1>
            <p className="text-xs text-muted">Sign in to continue</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-muted uppercase tracking-wider font-medium mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoFocus
              autoComplete="username"
              className="w-full bg-bg border border-border text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-accent placeholder-muted"
            />
          </div>
          <div>
            <label className="block text-xs text-muted uppercase tracking-wider font-medium mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full bg-bg border border-border text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-accent placeholder-muted"
            />
          </div>
          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={!username.trim() || !password.trim() || loading}
            className="w-full py-2.5 bg-accent text-white font-medium text-sm rounded-lg hover:bg-accent-dark transition-colors disabled:opacity-40"
          >
            {loading ? 'Signing in...' : 'Sign In'}
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
  const [secret, setSecret] = useState<string | null>(() => localStorage.getItem('admin_token'));
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
    localStorage.removeItem('admin_token');
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
