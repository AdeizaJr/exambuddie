"use client";

import { useState, useRef } from "react";

const BOT_URL = "https://t.me/ExamBuddieBot";

const subjects = [
  { icon: "📐", name: "Mathematics" },
  { icon: "🔬", name: "Biology" },
  { icon: "⚗️", name: "Chemistry" },
  { icon: "⚡", name: "Physics" },
  { icon: "📖", name: "English Language" },
  { icon: "🌍", name: "Geography" },
  { icon: "📜", name: "History" },
  { icon: "💰", name: "Economics" },
  { icon: "📊", name: "Accounts" },
  { icon: "✝️", name: "CRK / IRK" },
  { icon: "🌱", name: "Agric Science" },
  { icon: "🏛️", name: "Government" },
];

const features = [
  {
    icon: "📚",
    title: "Practice Mode",
    description:
      "Go through past questions at your own pace with instant explanations after every answer.",
  },
  {
    icon: "📋",
    title: "Timed Quiz",
    description:
      "Simulate real exam conditions with a countdown timer. 40 questions, exam-style pressure.",
  },
  {
    icon: "🎯",
    title: "Drill Mode",
    description:
      "Zero in on your weakest topics. ExamBuddie identifies the gaps and drills you on them.",
  },
  {
    icon: "📊",
    title: "Progress Stats",
    description:
      "Track accuracy by subject and topic. Know exactly where you stand before exam day.",
  },
  {
    icon: "🏆",
    title: "Multi-Subject Sessions",
    description: "Mix subjects in a single practice or quiz session — just like the real exam.",
  },
  {
    icon: "⚡",
    title: "Works in Telegram",
    description:
      "No app download. No account. Open Telegram, start a chat, and you're practising in seconds.",
  },
];

const whyTelegram = [
  {
    icon: "📲",
    title: "No download needed",
    desc: "If you have Telegram, you're ready. No app store, no install, no storage space used.",
  },
  {
    icon: "📱",
    title: "Works on any device",
    desc: "Android, iPhone, or desktop — ExamBuddie works everywhere Telegram does.",
  },
  {
    icon: "⚡",
    title: "Zero setup",
    desc: "Tap Start, pick your subjects, and your first question arrives in under 30 seconds.",
  },
  {
    icon: "🔄",
    title: "Progress always synced",
    desc: "Switch devices and your stats, streak, and history are always up to date.",
  },
];

const faqs = [
  {
    q: "Do I need to download anything?",
    a: "No. ExamBuddie runs entirely inside Telegram. If you have Telegram installed, you're ready to go.",
  },
  {
    q: "Which exams does ExamBuddie cover?",
    a: "WAEC, JAMB and NECO. Questions span all major subjects including Maths, English, Sciences, Humanities and more.",
  },
  {
    q: "How many questions are in the database?",
    a: "Over 41,000 past questions with explanations, sourced from real WAEC, JAMB and NECO papers.",
  },
  {
    q: "Can I use ExamBuddie on mobile?",
    a: "Yes — Telegram works on Android, iOS, and desktop. ExamBuddie works on all of them.",
  },
  {
    q: "What happens when I hit the free limit?",
    a: "Your 5-question window resets every 6 hours, giving you up to 20 questions per subject per day on the free plan.",
  },
  {
    q: "How do I upgrade to Premium?",
    a: "Send /subscribe inside the bot and follow the prompts. Upgrades are instant.",
  },
  {
    q: "Is my data safe?",
    a: "Yes. ExamBuddie only stores your Telegram ID, name, exam type, subjects, and practice history. We never access your Telegram messages or contacts.",
  },
  {
    q: "Can I change my exam type or subjects later?",
    a: "Yes. Send /settings in the bot at any time to update your exam type or add and remove subjects.",
  },
  {
    q: "Does ExamBuddie work without internet?",
    a: "No — you need an internet connection since ExamBuddie runs inside Telegram. However, it works on any network including mobile data.",
  },
  {
    q: "Can I cancel my Premium subscription?",
    a: "Premium is a one-time payment per period — monthly or yearly. It does not auto-renew, so there is nothing to cancel.",
  },
];

const mockQuestions = [
  {
    subject: "Mathematics · WAEC 2023",
    question: "If 2x + 5 = 13, what is the value of x?",
    options: ["A. x = 3", "B. x = 4", "C. x = 6", "D. x = 9"],
    correct: 1,
    explanation: "2x = 13 − 5 = 8, so x = 4. Answer is B.",
  },
  {
    subject: "Biology · JAMB 2022",
    question: "Which organelle is responsible for producing energy in a cell?",
    options: ["A. Nucleus", "B. Ribosome", "C. Mitochondria", "D. Golgi body"],
    correct: 2,
    explanation: "Mitochondria is the powerhouse of the cell, producing ATP through cellular respiration.",
  },
  {
    subject: "Chemistry · WAEC 2022",
    question: "What is the chemical formula for water?",
    options: ["A. CO₂", "B. NaCl", "C. H₂O", "D. O₂"],
    correct: 2,
    explanation: "Water is made of 2 hydrogen atoms and 1 oxygen atom — H₂O. Answer is C.",
  },
  {
    subject: "Physics · NECO 2023",
    question: "What is the SI unit of electric current?",
    options: ["A. Volt", "B. Watt", "C. Ohm", "D. Ampere"],
    correct: 3,
    explanation: "The SI unit of electric current is the Ampere (A), named after André-Marie Ampère.",
  },
  {
    subject: "English Language · WAEC 2023",
    question: "Choose the word closest in meaning to 'ELOQUENT'.",
    options: ["A. Silent", "B. Fluent", "C. Angry", "D. Confused"],
    correct: 1,
    explanation: "Eloquent means fluent and persuasive in speaking or writing. Answer is B.",
  },
  {
    subject: "Geography · JAMB 2022",
    question: "Which of these is the largest river in Nigeria?",
    options: ["A. Kaduna River", "B. Benue River", "C. Niger River", "D. Cross River"],
    correct: 2,
    explanation: "The Niger River is the largest river in Nigeria, flowing through the country before emptying into the Atlantic.",
  },
  {
    subject: "History · NECO 2022",
    question: "In what year did Nigeria gain independence?",
    options: ["A. 1955", "B. 1960", "C. 1963", "D. 1966"],
    correct: 1,
    explanation: "Nigeria gained independence from British rule on October 1, 1960. Answer is B.",
  },
  {
    subject: "Economics · WAEC 2023",
    question: "When demand increases and supply remains constant, price will:",
    options: ["A. Fall", "B. Stay the same", "C. Rise", "D. Fluctuate randomly"],
    correct: 2,
    explanation: "When demand rises with constant supply, scarcity increases, pushing prices up. Answer is C.",
  },
  {
    subject: "Accounts · JAMB 2022",
    question: "Which accounting equation is correct?",
    options: ["A. Assets = Liabilities − Capital", "B. Assets = Capital + Liabilities", "C. Capital = Assets + Liabilities", "D. Liabilities = Assets + Capital"],
    correct: 1,
    explanation: "The fundamental accounting equation is Assets = Capital + Liabilities. Answer is B.",
  },
  {
    subject: "CRK · WAEC 2022",
    question: "According to the Bible, who was thrown into the den of lions?",
    options: ["A. Joseph", "B. Elijah", "C. Daniel", "D. Ezekiel"],
    correct: 2,
    explanation: "Daniel was thrown into the den of lions by King Darius but was protected by God. Answer is C.",
  },
  {
    subject: "Agric Science · NECO 2023",
    question: "Which of these is a leguminous crop?",
    options: ["A. Maize", "B. Cassava", "C. Soybean", "D. Yam"],
    correct: 2,
    explanation: "Soybean is a leguminous crop that fixes atmospheric nitrogen into the soil. Answer is C.",
  },
  {
    subject: "Government · WAEC 2023",
    question: "The principle of separation of powers was propounded by:",
    options: ["A. John Locke", "B. Montesquieu", "C. Jean-Jacques Rousseau", "D. Thomas Hobbes"],
    correct: 1,
    explanation: "Baron de Montesquieu propounded the doctrine of separation of powers in 'The Spirit of the Laws'. Answer is B.",
  },
];

function BotMockup() {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef<number | null>(null);


  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      setCurrent((c) =>
        diff > 0
          ? (c + 1) % mockQuestions.length
          : (c - 1 + mockQuestions.length) % mockQuestions.length
      );
    }
    touchStartX.current = null;
  }

  const q = mockQuestions[current];

  return (
    <div className="relative mx-auto w-full max-w-xs">
      <div
        className="overflow-hidden rounded-3xl border-4 border-slate-800 shadow-2xl shadow-slate-900/40"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Telegram-style header */}
        <div className="flex items-center gap-3 bg-[#2b5278] px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white shadow">
            E
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">ExamBuddie</p>
            <p className="text-xs text-blue-300">bot · online</p>
          </div>
        </div>

        {/* Chat area */}
        <div className="min-h-72 space-y-3 bg-[#0d1117] p-3 transition-all duration-300">
          {/* Bot question message */}
          <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-[#2b5278] p-3">
            <p className="mb-1.5 text-[10px] font-semibold text-blue-300">📝 {q.subject}</p>
            <p className="text-xs leading-relaxed text-white">{q.question}</p>
          </div>

          {/* Answer options */}
          <div className="space-y-1.5">
            {q.options.map((label, i) => (
              <div
                key={label}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  i === q.correct ? "bg-green-600 text-white" : "bg-[#1e3a5f] text-slate-300"
                }`}
              >
                {label} {i === q.correct && "✓"}
              </div>
            ))}
          </div>

          {/* Explanation */}
          <div className="max-w-[88%] rounded-xl border border-green-800/40 bg-[#162a1e] p-2.5">
            <p className="mb-1 text-[10px] font-bold text-green-400">💡 Explanation</p>
            <p className="text-[10px] leading-relaxed text-green-200">{q.explanation}</p>
          </div>

          {/* Next button */}
          <div className="flex justify-end">
            <button
              onClick={() => setCurrent((c) => (c + 1) % mockQuestions.length)}
              className="rounded-full bg-blue-600 px-3 py-1 text-[10px] font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Next question →
            </button>
          </div>
        </div>

        {/* Navigation bar */}
        <div className="flex items-center justify-between bg-[#0d1117] px-3 pb-3">
          <button
            onClick={() => setCurrent((c) => (c - 1 + mockQuestions.length) % mockQuestions.length)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1e3a5f] text-slate-300 transition-colors hover:bg-blue-600 hover:text-white text-xs"
          >
            ‹
          </button>
          <div className="text-center">
            <span className="text-[10px] font-semibold text-blue-400">{current + 1} / {mockQuestions.length}</span>
            <p className="text-[9px] text-slate-500 leading-none mt-0.5">swipe to browse</p>
          </div>
          <button
            onClick={() => setCurrent((c) => (c + 1) % mockQuestions.length)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1e3a5f] text-slate-300 transition-colors hover:bg-blue-600 hover:text-white text-xs"
          >
            ›
          </button>
        </div>
      </div>

      {/* Floating badge */}
      <div className="absolute -right-3 -top-3 rounded-full bg-green-500 px-2.5 py-1 text-[10px] font-bold text-white shadow-lg">
        Live bot
      </div>
    </div>
  );
}

export default function Home() {
  const [billingYearly, setBillingYearly] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const plans = [
    {
      name: "Free",
      price: "₦0",
      period: "forever",
      description: "Start practising today at no cost.",
      features: [
        "5 questions per subject every 6 hours",
        "All WAEC, JAMB & NECO subjects",
        "Instant answer explanations",
        "Basic stats tracking",
      ],
      cta: "Start Free",
      href: BOT_URL,
      highlight: false,
      badge: null,
    },
    {
      name: "Premium",
      price: billingYearly ? "₦7,000" : "₦800",
      period: billingYearly ? "per year" : "per month",
      description: billingYearly
        ? "Save ₦2,600 vs monthly — best value."
        : "Everything you need to top the exam.",
      features: [
        "Unlimited questions — no daily caps",
        "Multi-subject quiz & practice",
        "Full drill mode on weak topics",
        "Detailed progress analytics",
        "Weekly performance reports",
        "Priority support",
      ],
      cta: "Go Premium",
      href: BOT_URL,
      highlight: true,
      badge: billingYearly ? "Save 27%" : null,
    },
  ];

  return (
    <div className="font-[var(--font-geist)]">
      {/* Nav */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <span className="text-lg font-bold text-blue-600 sm:text-xl">ExamBuddie</span>
          <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="transition-colors hover:text-slate-900">Features</a>
            <a href="#subjects" className="transition-colors hover:text-slate-900">Subjects</a>
            <a href="#pricing" className="transition-colors hover:text-slate-900">Pricing</a>
            <a href="#faq" className="transition-colors hover:text-slate-900">FAQ</a>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={BOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-blue-600 px-3 py-2 text-xs font-semibold whitespace-nowrap text-white transition-colors hover:bg-blue-700 sm:px-4 sm:text-sm"
            >
              <span className="md:hidden">Open Bot</span>
              <span className="hidden md:inline">Open in Telegram</span>
            </a>
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
              aria-label="Toggle menu"
            >
              {menuOpen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              )}
            </button>
          </div>
        </div>
        {/* Mobile menu dropdown */}
        {menuOpen && (
          <div className="border-t border-slate-100 bg-white px-4 py-4 md:hidden">
            <div className="flex flex-col gap-4 text-sm font-medium text-slate-600">
              <a href="#features" onClick={() => setMenuOpen(false)} className="hover:text-slate-900">Features</a>
              <a href="#subjects" onClick={() => setMenuOpen(false)} className="hover:text-slate-900">Subjects</a>
              <a href="#pricing" onClick={() => setMenuOpen(false)} className="hover:text-slate-900">Pricing</a>
              <a href="#faq" onClick={() => setMenuOpen(false)} className="hover:text-slate-900">FAQ</a>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-50 to-white px-4 pt-28 pb-16 sm:px-6 sm:pt-32 sm:pb-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-center lg:gap-16">
            {/* Text */}
            <div className="flex-1 text-center lg:text-left">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700 sm:px-4 sm:text-sm">
                🎓 WAEC, JAMB &amp; NECO Prep — Nigeria
              </div>
              <h1 className="mb-5 text-3xl leading-tight font-extrabold tracking-tight text-slate-900 sm:mb-6 sm:text-5xl md:text-6xl">
                Pass your exam.
                <br />
                <span className="text-blue-600">Study on Telegram.</span>
              </h1>
              <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-slate-600 sm:mb-10 sm:text-lg md:text-xl lg:mx-0">
                AI-powered exam prep with over 41,000 past WAEC, JAMB and NECO questions. Timed
                quizzes, instant explanations, and progress tracking — all inside Telegram. No app
                to download.
              </p>
              <div className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4 lg:justify-start">
                <a
                  href={BOT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-blue-600 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-200 transition-colors hover:bg-blue-700 sm:px-8 sm:py-4 sm:text-lg"
                >
                  Start Practising Free →
                </a>
                <a
                  href="#features"
                  className="rounded-full border border-slate-200 px-6 py-3.5 text-base font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 sm:px-8 sm:py-4 sm:text-lg"
                >
                  See how it works
                </a>
              </div>
              <p className="mt-5 text-xs text-slate-400 sm:mt-6 sm:text-sm">
                Free to start · No download required · Works on any device
              </p>
            </div>

            {/* Bot mockup */}
            <div className="w-full max-w-xs flex-shrink-0 lg:max-w-sm">
              <BotMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-blue-600 py-8 sm:py-10">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 px-4 text-center text-white sm:gap-8 sm:px-6 md:grid-cols-4">
          {[
            { value: "41,000+", label: "Past Questions", nowrap: false },
            { value: "12+", label: "Subjects Covered", nowrap: false },
            { value: "WAEC · JAMB · NECO", label: "Exams Covered", nowrap: true },
            { value: "Free", label: "To Start", nowrap: false },
          ].map(({ value, label, nowrap }) => (
            <div key={label}>
              <div className="whitespace-nowrap text-lg leading-tight font-extrabold sm:text-xl md:text-2xl">
                {value}
              </div>
              <div className="mt-1 text-xs text-blue-200 sm:text-sm">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center sm:mb-16">
            <h2 className="mb-3 text-2xl font-extrabold text-slate-900 sm:mb-4 sm:text-3xl md:text-4xl">
              Everything you need to prepare
            </h2>
            <p className="mx-auto max-w-xl text-base text-slate-500 sm:text-lg">
              Built for Nigerian students. Designed to be fast, focused, and effective.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
            {features.map(({ icon, title, description }) => (
              <div
                key={title}
                className="rounded-2xl bg-slate-50 p-6 transition-shadow hover:shadow-md sm:p-8"
              >
                <div className="mb-3 text-3xl sm:mb-4 sm:text-4xl">{icon}</div>
                <h3 className="mb-2 text-base font-bold text-slate-900 sm:text-lg">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-500 sm:text-base">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Telegram? */}
      <section className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center sm:mb-16">
            <h2 className="mb-3 text-2xl font-extrabold text-slate-900 sm:mb-4 sm:text-3xl md:text-4xl">
              Why Telegram?
            </h2>
            <p className="mx-auto max-w-xl text-base text-slate-500 sm:text-lg">
              No new app. No login. Just open Telegram — which you already have.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4">
            {whyTelegram.map(({ icon, title, desc }) => (
              <div
                key={title}
                className="flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-6"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-2xl">
                  {icon}
                </span>
                <div>
                  <h3 className="mb-1 text-sm font-bold text-slate-900 sm:text-base">{title}</h3>
                  <p className="text-xs leading-relaxed text-slate-500 sm:text-sm">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-3 text-2xl font-extrabold text-slate-900 sm:mb-4 sm:text-3xl md:text-4xl">
            Up and running in 30 seconds
          </h2>
          <p className="mb-12 text-base text-slate-500 sm:mb-16 sm:text-lg">
            No sign-up forms. No app stores. Just Telegram.
          </p>
          <div className="grid gap-8 sm:grid-cols-3 sm:gap-10">
            {[
              {
                step: "1",
                title: "Open Telegram",
                desc: "Search for @ExamBuddieBot or tap the button below.",
              },
              {
                step: "2",
                title: "Pick your subjects",
                desc: "Choose WAEC, JAMB or NECO and the subjects you're studying.",
              },
              {
                step: "3",
                title: "Start practising",
                desc: "Practice, quiz, or drill — your progress saves automatically.",
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col items-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-xl font-extrabold text-white shadow-lg shadow-blue-200 sm:h-14 sm:w-14 sm:text-2xl">
                  {step}
                </div>
                <h3 className="mb-2 text-base font-bold text-slate-900 sm:text-lg">{title}</h3>
                <p className="text-sm text-slate-500 sm:text-base">{desc}</p>
              </div>
            ))}
          </div>
          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-10 inline-block rounded-full bg-blue-600 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-200 transition-colors hover:bg-blue-700 sm:mt-12 sm:px-8 sm:py-4 sm:text-lg"
          >
            Open ExamBuddie →
          </a>
        </div>
      </section>

      {/* Subjects */}
      <section id="subjects" className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center sm:mb-16">
            <h2 className="mb-3 text-2xl font-extrabold text-slate-900 sm:mb-4 sm:text-3xl md:text-4xl">
              All major subjects covered
            </h2>
            <p className="text-base text-slate-500 sm:text-lg">
              WAEC, JAMB and NECO past questions across every core subject.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-6">
            {subjects.map(({ icon, name }) => (
              <div
                key={name}
                className="flex flex-col items-center gap-2 rounded-xl bg-white p-3 text-center transition-colors hover:bg-blue-50 sm:p-4 border border-slate-100"
              >
                <span className="text-2xl sm:text-3xl">{icon}</span>
                <span className="text-xs font-medium text-slate-700 sm:text-sm">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center sm:mb-12">
            <h2 className="mb-3 text-2xl font-extrabold text-slate-900 sm:mb-4 sm:text-3xl md:text-4xl">
              Simple pricing
            </h2>
            <p className="mb-6 text-base text-slate-500 sm:text-lg">
              Start free. Upgrade when you need more.
            </p>

            {/* Billing toggle */}
            <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 p-1">
              <button
                onClick={() => setBillingYearly(false)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  !billingYearly
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingYearly(true)}
                className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  billingYearly
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Yearly
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                  Save 27%
                </span>
              </button>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
            {plans.map(({ name, price, period, description, features: planFeatures, cta, href, highlight, badge }) => (
              <div
                key={name}
                className={`relative flex flex-col rounded-2xl p-6 sm:p-8 ${
                  highlight
                    ? "bg-blue-600 text-white shadow-2xl ring-2 shadow-blue-200 ring-blue-600"
                    : "border border-slate-200 bg-white"
                }`}
              >
                {badge && (
                  <span className="absolute -top-3 right-6 rounded-full bg-green-500 px-3 py-1 text-xs font-bold text-white shadow">
                    {badge}
                  </span>
                )}
                <div className="mb-5 sm:mb-6">
                  <div className={`mb-1 text-xs font-semibold tracking-wide uppercase sm:text-sm ${highlight ? "text-blue-200" : "text-blue-600"}`}>
                    {name}
                  </div>
                  <div className="mb-2 flex items-end gap-1">
                    <span className={`text-3xl font-extrabold sm:text-4xl ${highlight ? "text-white" : "text-slate-900"}`}>
                      {price}
                    </span>
                    <span className={`mb-1.5 text-xs sm:text-sm ${highlight ? "text-blue-200" : "text-slate-400"}`}>
                      /{period}
                    </span>
                  </div>
                  <p className={`text-xs sm:text-sm ${highlight ? "text-blue-100" : "text-slate-500"}`}>
                    {description}
                  </p>
                </div>
                <ul className="mb-6 flex-1 space-y-3 sm:mb-8">
                  {planFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-xs sm:text-sm">
                      <span className={highlight ? "text-blue-200" : "text-blue-600"}>✓</span>
                      <span className={highlight ? "text-blue-50" : "text-slate-600"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full rounded-full py-3 text-center text-sm font-bold transition-colors sm:text-base ${
                    highlight
                      ? "bg-white text-blue-600 hover:bg-blue-50"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compare */}
      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center sm:mb-16">
            <h2 className="mb-3 text-2xl font-extrabold text-slate-900 sm:mb-4 sm:text-3xl md:text-4xl">
              Why ExamBuddie beats the alternatives
            </h2>
            <p className="text-base text-slate-500 sm:text-lg">
              Compare how students prepare — and why the bot wins.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:px-6">Feature</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-blue-600 sm:px-6">ExamBuddie</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400 sm:px-6">Textbooks</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400 sm:px-6">YouTube</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  ["Past questions (WAEC, JAMB, NECO)", true, true, false],
                  ["Instant answer explanations", true, false, false],
                  ["Progress tracking", true, false, false],
                  ["Timed mock exams", true, false, false],
                  ["Works on any phone", true, false, true],
                  ["No download required", true, false, true],
                  ["AI-powered insights", true, false, false],
                  ["Free to start", true, false, true],
                ].map(([feature, eb, tb, yt]) => (
                  <tr key={String(feature)} className="hover:bg-slate-50">
                    <td className="px-4 py-3.5 font-medium text-slate-700 sm:px-6">{feature}</td>
                    <td className="px-4 py-3.5 text-center sm:px-6">
                      {eb ? <span className="text-green-500 font-bold text-base">✓</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-center sm:px-6">
                      {tb ? <span className="text-green-500 font-bold text-base">✓</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-center sm:px-6">
                      {yt ? <span className="text-green-500 font-bold text-base">✓</span> : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center sm:mb-16">
            <h2 className="mb-3 text-2xl font-extrabold text-slate-900 sm:mb-4 sm:text-3xl md:text-4xl">
              Frequently asked questions
            </h2>
          </div>
          <div className="divide-y divide-slate-200">
            {faqs.map(({ q, a }) => (
              <div key={q} className="py-5 sm:py-6">
                <h3 className="mb-2 text-sm font-semibold text-slate-900 sm:text-base">{q}</h3>
                <p className="text-sm leading-relaxed text-slate-500 sm:text-base">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-blue-600 px-4 py-16 text-center text-white sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-3 text-2xl font-extrabold sm:mb-4 sm:text-3xl md:text-4xl">
            Ready to ace your exam?
          </h2>
          <p className="mb-8 text-base text-blue-100 sm:mb-10 sm:text-lg">
            Join thousands of Nigerian students already practising on ExamBuddie.
          </p>
          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full bg-white px-8 py-3.5 text-base font-bold text-blue-600 shadow-xl transition-colors hover:bg-blue-50 sm:px-10 sm:py-4 sm:text-lg"
          >
            Start Practising Free →
          </a>
          <p className="mt-4 text-xs text-blue-200 sm:text-sm">
            No download. No sign-up. Open Telegram and go.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="flex flex-col items-center justify-between gap-3 text-center text-xs text-slate-400 sm:gap-4 sm:text-sm md:flex-row md:text-left">
            <span className="text-sm font-bold text-slate-700 sm:text-base">ExamBuddie</span>
            <span>© {new Date().getFullYear()} ExamBuddie. Built with ❤️ for Nigerian students.</span>
            <a
              href={BOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-600 hover:underline"
            >
              Open in Telegram →
            </a>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 md:justify-start">
            <a href="/privacy" className="hover:text-blue-600 hover:underline">Privacy Policy</a>
            <a href="/terms" className="hover:text-blue-600 hover:underline">Terms of Use</a>
            <a href="/refunds" className="hover:text-blue-600 hover:underline">Refund Policy</a>
          </div>
        </div>
      </footer>

      {/* Sticky mobile CTA */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <a
          href={BOT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-full bg-blue-600 py-3 text-center text-sm font-bold text-white shadow-lg shadow-blue-200 transition-colors hover:bg-blue-700"
        >
          Start Practising Free →
        </a>
      </div>
    </div>
  );
}
