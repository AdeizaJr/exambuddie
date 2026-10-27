import React, { useState, useEffect } from "react";
import { NavLink, Outlet } from "react-router";
import {
  LayoutDashboard,
  HelpCircle,
  Users,
  Flag,
  Bell,
  CreditCard,
  BarChart2,
  Megaphone,
  KeyRound,
  LogOut,
  X,
  Menu,
  Zap,
  Trophy,
  CalendarDays,
  Tag,
  ScrollText,
  Bug,
  UserPlus,
} from "lucide-react";
import Modal from "./Modal";
import { changePassword } from "../api";

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

interface LayoutProps {
  pendingFlags: number;
  pendingAlerts: number;
  pendingBugs: number;
  onLogout: () => void;
}

interface NavGroup {
  title: string | null;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: null,
    items: [
      { path: "/overview",  label: "Overview",  icon: <LayoutDashboard size={16} /> },
      { path: "/analytics", label: "Analytics", icon: <BarChart2 size={16} />       },
    ],
  },
  {
    title: "Content",
    items: [
      { path: "/questions", label: "Questions", icon: <HelpCircle size={16} />   },
      { path: "/qotd",      label: "QOTD",      icon: <CalendarDays size={16} /> },
      { path: "/flags",     label: "Flags",     icon: <Flag size={16} />         },
    ],
  },
  {
    title: "People",
    items: [
      { path: "/users",         label: "Users",         icon: <Users size={16} />      },
      { path: "/subscriptions", label: "Subscriptions", icon: <CreditCard size={16} /> },
      { path: "/leaderboard",   label: "Leaderboard",   icon: <Trophy size={16} />     },
      { path: "/signups",       label: "Signups",       icon: <UserPlus size={16} />   },
    ],
  },
  {
    title: "Comms",
    items: [
      { path: "/broadcast",   label: "Broadcast",   icon: <Megaphone size={16} /> },
      { path: "/alerts",      label: "Alerts",      icon: <Bell size={16} />      },
      { path: "/bug-reports", label: "Bug Reports", icon: <Bug size={16} />       },
    ],
  },
  {
    title: "System",
    items: [
      { path: "/pricing",   label: "Pricing",   icon: <Tag size={16} />        },
      { path: "/audit-log", label: "Audit Log", icon: <ScrollText size={16} /> },
    ],
  },
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
    if (next !== confirm) { setError("New passwords do not match."); return; }
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

  const inputClass =
    "w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-white placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 transition-colors";

  if (success) {
    return (
      <Modal title="Change Password" onClose={onClose}>
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/20">
            <Zap size={20} className="text-success" />
          </div>
          <p className="font-medium text-success">Password updated successfully.</p>
          <button onClick={onClose} className="rounded-lg bg-gradient-accent px-4 py-2 text-sm font-medium text-white">
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Change Password" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {[
          { id: "pw-current", label: "Current Password", value: current, setter: setCurrent, auto: "current-password" },
          { id: "pw-next",    label: "New Password",      value: next,    setter: setNext,    auto: "new-password"     },
          { id: "pw-confirm", label: "Confirm New Password", value: confirm, setter: setConfirm, auto: "new-password" },
        ].map(({ id, label, value, setter, auto }, i) => (
          <div key={id}>
            <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
              {label}
            </label>
            <input
              id={id}
              type="password"
              value={value}
              onChange={(e) => setter(e.target.value)}
              autoFocus={i === 0}
              autoComplete={auto}
              className={inputClass}
            />
          </div>
        ))}
        {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted transition-colors hover:text-white">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!current || !next || !confirm || loading}
            className="rounded-lg bg-gradient-accent px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-40"
          >
            {loading ? "Updating…" : "Update Password"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Layout({ pendingFlags, pendingAlerts, pendingBugs, onLogout }: LayoutProps) {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function closeMobile() { setMobileOpen(false); }

  // The backdrop itself is only click-dismissible — this covers keyboard users, who
  // otherwise had no way to back out of the open sidebar short of tabbing all the way
  // to its own close button.
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeMobile(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mobileOpen]);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-accent shadow-glow">
            <span className="font-display text-sm font-bold text-white">E</span>
          </div>
          <div>
            <p className="font-display text-sm font-bold leading-tight text-white">ExamBuddie</p>
            <p className="text-[10px] leading-tight text-muted">Admin Panel</p>
          </div>
        </div>
        <button onClick={closeMobile} className="p-1 text-muted transition-colors hover:text-white lg:hidden">
          <X size={16} />
        </button>
      </div>

      <div className="mx-4 mb-3 h-px bg-border" />

      {/* Nav */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.title ?? "main"} className="space-y-0.5">
            {group.title && (
              <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted/70">{group.title}</p>
            )}
            {group.items.map((item) => {
              const badge =
                item.path === "/flags" && pendingFlags > 0 ? pendingFlags :
                item.path === "/alerts" && pendingAlerts > 0 ? pendingAlerts :
                item.path === "/bug-reports" && pendingBugs > 0 ? pendingBugs : 0;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={closeMobile}
                  className={({ isActive }) =>
                    `group relative flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-accent/10 text-accent-light before:absolute before:left-0 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-accent"
                        : "text-muted hover:bg-surface2 hover:text-white"
                    }`
                  }
                >
                  <span className="flex items-center gap-3">
                    <span className="flex-shrink-0">{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                  {badge > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="mx-4 mt-3 h-px bg-border" />
      <div className="space-y-0.5 px-2 py-3">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          <span className="text-xs text-muted">Live · v1.0.0</span>
        </div>
        <button
          onClick={() => { setShowChangePassword(true); closeMobile(); }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-all hover:bg-surface2 hover:text-white"
        >
          <KeyRound size={16} />
          <span>Change Password</span>
        </button>
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-all hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut size={16} />
          <span>Log Out</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-white">
      {/* Mobile top bar */}
      <div className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur-sm lg:hidden">
        <button onClick={() => setMobileOpen(true)} className="p-1.5 text-muted transition-colors hover:text-white">
          <Menu size={18} />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-accent">
            <span className="font-display text-xs font-bold text-white">E</span>
          </div>
          <p className="font-display text-sm font-bold text-white">ExamBuddie Admin</p>
        </div>
        {pendingFlags + pendingAlerts + pendingBugs > 0 && (
          <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {pendingFlags + pendingAlerts + pendingBugs > 9 ? "9+" : pendingFlags + pendingAlerts + pendingBugs}
          </span>
        )}
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={closeMobile} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-shrink-0 flex-col border-r border-border bg-surface transition-transform duration-200 ease-in-out lg:static lg:z-auto lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
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
