import React from 'react';
import type { Page } from '../types';

interface NavItem {
  id: Page;
  label: string;
  icon: string;
  badge?: number;
}

interface LayoutProps {
  page: Page;
  onNavigate: (page: Page) => void;
  pendingFlags: number;
  onLogout: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS: Omit<NavItem, 'badge'>[] = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'questions', label: 'Questions', icon: '❓' },
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'flags', label: 'Flags', icon: '🚩' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '💳' },
  { id: 'analytics', label: 'Analytics', icon: '📈' },
  { id: 'broadcast', label: 'Broadcast', icon: '📢' },
];

export default function Layout({ page, onNavigate, pendingFlags, onLogout, children }: LayoutProps) {
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
              <p className="text-sm font-bold font-display text-white leading-tight">ExamAce</p>
              <p className="text-xs text-muted leading-tight">Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = page === item.id;
            const badge = item.id === 'flags' && pendingFlags > 0 ? pendingFlags : 0;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors group ${
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'text-muted hover:text-white hover:bg-surface2'
                }`}
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
              </button>
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

      {/* Main */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
