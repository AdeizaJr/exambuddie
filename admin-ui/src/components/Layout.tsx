import React, { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import Modal from "./Modal";
import { changePassword } from "../api";

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

interface LayoutProps {
  pendingFlags: number;
  onLogout: () => void;
}

const NAV_ITEMS: NavItem[] = [
  { path: "/overview", label: "Overview", icon: "📊" },
  { path: "/questions", label: "Questions", icon: "❓" },
  { path: "/users", label: "Users", icon: "👥" },
  { path: "/flags", label: "Flags", icon: "🚩" },
  { path: "/subscriptions", label: "Subscriptions", icon: "💳" },
  { path: "/analytics", label: "Analytics", icon: "📈" },
  { path: "/broadcast", label: "Broadcast", icon: "📢" },
];

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await changePassword(current, next);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to change password.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <Modal title="Change Password" onClose={onClose}>
        <div className="space-y-4 text-center">
          <p className="font-medium text-green-400">Password updated successfully.</p>
          <button
            onClick={onClose}
            className="rounded-lg bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-dark"
          >
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Change Password" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
            Current Password
          </label>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoFocus
            autoComplete="current-password"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-white placeholder-muted focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
            New Password
          </label>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-white placeholder-muted focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
            Confirm New Password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-white placeholder-muted focus:border-accent focus:outline-none"
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted transition-colors hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!current || !next || !confirm || loading}
            className="rounded-lg bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-dark disabled:opacity-40"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Layout({ pendingFlags, onLogout }: LayoutProps) {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function closeMobile() {
    setMobileOpen(false);
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between border-b border-border px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent font-display text-sm font-bold text-white">
            E
          </div>
          <div>
            <p className="font-display text-sm font-bold leading-tight text-white">ExamBuddie</p>
            <p className="text-xs leading-tight text-muted">Admin Panel</p>
          </div>
        </div>
        <button
          onClick={closeMobile}
          className="p-1 text-muted transition-colors hover:text-white lg:hidden"
          aria-label="Close menu"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const badge = item.path === "/flags" && pendingFlags > 0 ? pendingFlags : 0;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={closeMobile}
              className={({ isActive }) =>
                `group flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-accent/15 text-accent"
                    : "text-muted hover:bg-surface2 hover:text-white"
                }`
              }
            >
              <span className="flex items-center gap-2.5">
                <span className="text-base leading-none">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </span>
              {badge > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold leading-none text-white">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="space-y-1 border-t border-border px-3 py-3">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          <span className="text-xs text-muted">Live · v1.0.0</span>
        </div>
        <button
          onClick={() => {
            setShowChangePassword(true);
            closeMobile();
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface2 hover:text-white"
        >
          <span className="text-base leading-none">🔑</span>
          <span className="font-medium">Change Password</span>
        </button>
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
        >
          <span className="text-base leading-none">🚪</span>
          <span className="font-medium">Log Out</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-white">
      {/* Mobile top bar */}
      <div className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 text-muted transition-colors hover:text-white"
          aria-label="Open menu"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent font-display text-xs font-bold text-white">
            E
          </div>
          <p className="font-display text-sm font-bold text-white">ExamBuddie Admin</p>
        </div>
        {pendingFlags > 0 && (
          <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {pendingFlags > 9 ? "9+" : pendingFlags}
          </span>
        )}
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={closeMobile} />
      )}

      {/* Sidebar — drawer on mobile, static on desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-shrink-0 flex-col border-r border-border bg-surface transition-transform duration-200 ease-in-out lg:static lg:z-auto lg:w-56 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} `}
      >
        {sidebarContent}
      </aside>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <Outlet />
      </main>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </div>
  );
}
