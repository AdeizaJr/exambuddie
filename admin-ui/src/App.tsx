import React, { useState, useEffect, useCallback } from 'react';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import Questions from './pages/Questions';
import Users from './pages/Users';
import Flags from './pages/Flags';
import Subscriptions from './pages/Subscriptions';
import AnalyticsPage from './pages/Analytics';
import Broadcast from './pages/Broadcast';
import { getFlags } from './api';
import type { Page } from './types';

function SecretPrompt({ onSubmit }: { onSubmit: (secret: string) => void }) {
  const [value, setValue] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-white font-bold font-display text-lg">
            E
          </div>
          <div>
            <h1 className="text-lg font-bold font-display text-white">ExamAce Admin</h1>
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

export default function App() {
  const [secret, setSecret] = useState<string | null>(() => localStorage.getItem('admin_secret'));
  const [page, setPage] = useState<Page>('overview');
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

  function handleSecretSubmit(s: string) {
    localStorage.setItem('admin_secret', s);
    setSecret(s);
  }

  function handleLogout() {
    localStorage.removeItem('admin_secret');
    setSecret(null);
    setPage('overview');
  }

  if (!secret) {
    return <SecretPrompt onSubmit={handleSecretSubmit} />;
  }

  function renderPage() {
    switch (page) {
      case 'overview':
        return <Overview />;
      case 'questions':
        return <Questions />;
      case 'users':
        return <Users />;
      case 'flags':
        return <Flags />;
      case 'subscriptions':
        return <Subscriptions />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'broadcast':
        return <Broadcast />;
      default:
        return <Overview />;
    }
  }

  return (
    <Layout
      page={page}
      onNavigate={(p) => {
        setPage(p);
        if (p === 'flags') loadFlagCount();
      }}
      pendingFlags={pendingFlags}
      onLogout={handleLogout}
    >
      {renderPage()}
    </Layout>
  );
}
