import React, { useState, useEffect, useCallback } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router";
import Layout from "./components/Layout";
import Overview from "./pages/Overview";
import Questions from "./pages/Questions";
import Users from "./pages/Users";
import Flags from "./pages/Flags";
import Alerts from "./pages/Alerts";
import Subscriptions from "./pages/Subscriptions";
import AnalyticsPage from "./pages/Analytics";
import Broadcast from "./pages/Broadcast";
import LeaderboardPage from "./pages/Leaderboard";
import QOTDPage from "./pages/QOTD";
import Pricing from "./pages/Pricing";
import AuditLog from "./pages/AuditLog";
import BugReports from "./pages/BugReports";
import { getFlags, getAlerts, getBugReports, loginAdmin, LoginUnavailableError } from "./api";

// ── Login page ──────────────────────────────────────────────────────────────
function LoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setError("");
    setLoading(true);
    try {
      const { token } = await loginAdmin(username.trim(), password.trim());
      localStorage.setItem("admin_token", token);
      onLogin(token);
      navigate("/overview", { replace: true });
    } catch (err) {
      setError(
        err instanceof LoginUnavailableError
          ? "Can't reach the server right now. Check that the backend is running, then try again."
          : "Invalid username or password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-card-hover">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-accent shadow-glow">
            <span className="font-display text-2xl font-bold text-white">E</span>
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-white">ExamBuddie Admin</h1>
            <p className="mt-0.5 text-sm text-muted">Sign in to your dashboard</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-username" className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
              Username
            </label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoFocus
              autoComplete="username"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-white placeholder-muted focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-white placeholder-muted focus:border-accent focus:outline-none"
            />
          </div>
          {error && <p className="text-center text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={!username.trim() || !password.trim() || loading}
            className="w-full rounded-lg bg-gradient-accent py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {loading ? "Signing in..." : "Sign In"}
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
  pendingAlerts,
  pendingBugs,
  onLogout,
}: {
  secret: string;
  pendingFlags: number;
  pendingAlerts: number;
  pendingBugs: number;
  onLogout: () => void;
}) {
  if (!secret) return <Navigate to="/login" replace />;
  return <Layout pendingFlags={pendingFlags} pendingAlerts={pendingAlerts} pendingBugs={pendingBugs} onLogout={onLogout} />;
}

// ── Root app ────────────────────────────────────────────────────────────────
export default function App() {
  const [secret, setSecret] = useState<string | null>(() => localStorage.getItem("admin_token"));
  const [pendingFlags, setPendingFlags] = useState(0);
  const [pendingAlerts, setPendingAlerts] = useState(0);
  const [pendingBugs, setPendingBugs] = useState(0);

  const loadFlagCount = useCallback(async () => {
    try {
      const flags = await getFlags();
      setPendingFlags(flags.length);
    } catch {
      // non-fatal
    }
  }, []);

  const loadAlertCount = useCallback(async () => {
    try {
      const alerts = await getAlerts();
      setPendingAlerts(alerts.length);
    } catch {
      // non-fatal
    }
  }, []);

  const loadBugCount = useCallback(async () => {
    try {
      const bugs = await getBugReports(false);
      setPendingBugs(bugs.length);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    if (secret) {
      loadFlagCount();
      loadAlertCount();
      loadBugCount();
      const interval = setInterval(() => { loadFlagCount(); loadAlertCount(); loadBugCount(); }, 60_000);
      return () => clearInterval(interval);
    }
  }, [secret, loadFlagCount, loadAlertCount, loadBugCount]);

  function handleLogout() {
    localStorage.removeItem("admin_token");
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
            secret={secret ?? ""}
            pendingFlags={pendingFlags}
            pendingAlerts={pendingAlerts}
            pendingBugs={pendingBugs}
            onLogout={handleLogout}
          />
        }
      >
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<Overview />} />
        <Route path="/questions" element={<Questions />} />
        <Route path="/users" element={<Users />} />
        <Route path="/flags" element={<Flags onFlagsResolved={loadFlagCount} />} />
        <Route path="/alerts" element={<Alerts onAlertsResolved={loadAlertCount} />} />
        <Route path="/bug-reports" element={<BugReports onChanged={loadBugCount} />} />
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/broadcast" element={<Broadcast />} />
        <Route path="/qotd" element={<QOTDPage />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/audit-log" element={<AuditLog />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to={secret ? "/overview" : "/login"} replace />} />
    </Routes>
  );
}
