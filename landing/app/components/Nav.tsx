"use client";
import { useState } from "react";
import { ThemeToggle } from "../theme-toggle";

const BOT_URL = "https://t.me/ExamBuddieBot";

export function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#" className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="h-8 w-8 shrink-0">
            <defs>
              <linearGradient id="nav-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1D4ED8" />
                <stop offset="100%" stopColor="#6D28D9" />
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="7" fill="url(#nav-bg)" />
            <rect x="6" y="6" width="4" height="20" rx="1" fill="white" />
            <rect x="6" y="6" width="18" height="5" rx="1" fill="white" />
            <rect x="6" y="13.5" width="13" height="4" rx="1" fill="white" />
            <rect x="6" y="21" width="18" height="5" rx="1" fill="white" />
            <path d="M26,22 L26.8,24.5 L29.5,25.2 L26.8,26 L26,28.5 L25.2,26 L22.5,25.2 L25.2,24.5 Z" fill="#FDE68A" />
          </svg>
          <span className="text-lg font-bold text-blue-700 sm:text-xl dark:text-blue-400">ExamBuddie</span>
        </a>
        <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex dark:text-slate-300">
          <a href="#features" className="transition-colors hover:text-slate-900 dark:hover:text-white">Features</a>
          <a href="#subjects" className="transition-colors hover:text-slate-900 dark:hover:text-white">Subjects</a>
          <a href="#pricing" className="transition-colors hover:text-slate-900 dark:hover:text-white">Pricing</a>
          <a href="#faq" className="transition-colors hover:text-slate-900 dark:hover:text-white">FAQ</a>
          <a href="/blog" className="transition-colors hover:text-slate-900 dark:hover:text-white">Blog</a>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-blue-700 px-3 py-2 text-xs font-semibold whitespace-nowrap text-white transition-colors hover:bg-blue-800 sm:px-4 sm:text-sm"
          >
            <span className="md:hidden">Open Bot</span>
            <span className="hidden md:inline">Open in Telegram</span>
          </a>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>
      {menuOpen && (
        <div className="border-t border-slate-100 bg-white px-4 py-4 md:hidden dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-4 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#features" onClick={() => setMenuOpen(false)} className="hover:text-slate-900 dark:hover:text-white">Features</a>
            <a href="#subjects" onClick={() => setMenuOpen(false)} className="hover:text-slate-900 dark:hover:text-white">Subjects</a>
            <a href="#pricing" onClick={() => setMenuOpen(false)} className="hover:text-slate-900 dark:hover:text-white">Pricing</a>
            <a href="#faq" onClick={() => setMenuOpen(false)} className="hover:text-slate-900 dark:hover:text-white">FAQ</a>
            <a href="/blog" onClick={() => setMenuOpen(false)} className="hover:text-slate-900 dark:hover:text-white">Blog</a>
          </div>
        </div>
      )}
    </nav>
  );
}
