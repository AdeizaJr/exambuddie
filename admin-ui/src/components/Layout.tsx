import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import Modal from './Modal';
import { changePassword } from '../api';

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
  { path: '/overview',      label: 'Overview',      icon: '📊' },
  { path: '/questions',     label: 'Questions',     icon: '❓' },
  { path: '/users',         label: 'Users',         icon: '👥' },
  { path: '/flags',         label: 'Flags',         icon: '🚩' },
  { path: '/subscriptions', label: 'Subscriptions', icon: '💳' },
  { path: '/analytics',     label: 'Analytics',     icon: '📈' },
  { path: '/broadcast',     label: 'Broadcast',     icon: '📢' },
];

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await changePassword(current, next);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <Modal title="Change Password" onClose={onClose}>
        <div className="text-center space-y-4">
          <p className="text-green-400 font-medium">Password updated successfully.</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent-dark transition-colors"
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
          <label className="block text-xs text-muted uppercase tracking-wider font-medium mb-2">
            Current Password
          </label>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoFocus
            autoComplete="current-password"
            className="w-full bg-bg border border-border text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-accent placeholder-muted"
          />
        </div>
        <div>
          <label className="block text-xs text-muted uppercase tracking-wider font-medium mb-2">
            New Password
          </label>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            className="w-full bg-bg border border-border text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-accent placeholder-muted"
          />
        </div>
        <div>
          <label className="block text-xs text-muted uppercase tracking-wider font-medium mb-2">
            Confirm New Password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="w-full bg-bg border border-border text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-accent placeholder-muted"
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!current || !next || !confirm || loading}
            className="px-4 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent-dark transition-colors disabled:opacity-40"
          >
            {loading ? 'Updating...' : 'Update Password'}
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
      <div className="px-5 py-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-sm font-bold font-display text-white">
            E
          </div>
          <div>
            <p className="text-sm font-bold font-display text-white leading-tight">ExamBuddie</p>
            <p className="text-xs text-muted leading-tight">Admin Panel</p>
          </div>
        </div>
        <button
          onClick={closeMobile}
          className="lg:hidden p-1 text-muted hover:text-white transition-colors"
          aria-label="Close menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const badge = item.path === '/flags' && pendingFlags > 0 ? pendingFlags : 0;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={closeMobile}
              className={({ isActive }) =>
                `w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors group ${
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'text-muted hover:text-white hover:bg-surface2'
                }`
              }
            >
              <span className="flex items-center gap-2.5">
                <span className="text-base leading-none">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </span>
              {badge > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-border space-y-1">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-xs text-muted">Live · v1.0.0</span>
        </div>
        <button
          onClick={() => { setShowChangePassword(true); closeMobile(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted hover:text-white hover:bg-surface2 transition-colors"
        >
          <span className="text-base leading-none">🔑</span>
          <span className="font-medium">Change Password</span>
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
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
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-surface border-b border-border flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 text-muted hover:text-white transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center text-xs font-bold font-display text-white">E</div>
          <p className="text-sm font-bold font-display text-white">ExamBuddie Admin</p>
        </div>
        {pendingFlags > 0 && (
          <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {pendingFlags > 9 ? '9+' : pendingFlags}
          </span>
        )}
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar — drawer on mobile, static on desktop */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 flex-shrink-0 bg-surface border-r border-border flex flex-col
          transition-transform duration-200 ease-in-out
          lg:static lg:w-56 lg:translate-x-0 lg:z-auto
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {sidebarContent}
      </aside>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <Outlet />
      </main>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </div>
  );
}
