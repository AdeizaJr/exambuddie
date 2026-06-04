import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

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

export default function Layout({ pendingFlags, onLogout }: LayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-bg text-white">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-surface border-r border-border flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-sm font-bold font-display text-white">
              E
            </div>
            <div>
              <p className="text-sm font-bold font-display text-white leading-tight">ExamBuddi</p>
              <p className="text-xs text-muted leading-tight">Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const badge = item.path === '/flags' && pendingFlags > 0 ? pendingFlags : 0;
            return (
              <NavLink
                key={item.path}
                to={item.path}
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
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <span className="text-base leading-none">🚪</span>
            <span className="font-medium">Log Out</span>
          </button>
        </div>
      </aside>

      {/* Page content rendered by the router */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
