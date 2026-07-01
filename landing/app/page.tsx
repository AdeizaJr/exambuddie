import { ScrollProgress } from "./components/ScrollProgress";
import { Nav } from "./components/Nav";
import { BotMockup } from "./components/BotMockup";
import { BillingSection } from "./components/BillingSection";
import { FaqAccordion } from "./components/FaqAccordion";
import { testimonials } from "./data/testimonials";

const BOT_URL = "https://t.me/ExamBuddieBot";
const BOT_URL_LANDING = "https://t.me/ExamBuddieBot?start=from_landing";

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

const secondaryFeatures = [
  { icon: "🔄", title: "Revision Mode", desc: "Practice only the questions you previously got wrong — /revision" },
  { icon: "⭐", title: "Bookmark Questions", desc: "Save any question mid-practice and drill your bookmarks later" },
  { icon: "📊", title: "Progress Stats", desc: "Daily target, accuracy by topic, and exam countdown — all in /stats" },
  { icon: "📐", title: "Formula Sheets", desc: "Instant formula reference for Physics, Chemistry, Maths, Economics, Government — /formula" },
  { icon: "📅", title: "Exam Timetable", desc: "2026 WAEC/NECO/JAMB subject dates with countdown — /timetable" },
  { icon: "🏆", title: "Multi-Subject", desc: "Mix subjects in one practice session (Premium)" },
  { icon: "🔥", title: "Study Streaks", desc: "Build a daily habit — freeze your streak once a week (Premium)" },
  { icon: "🔁", title: "Spaced Repetition", desc: "Wrong answers resurface until you master them — /review" },
  { icon: "📅", title: "Daily Question", desc: "Question of the Day broadcast every morning with your exam type" },
  { icon: "🏅", title: "Achievements & Ranks", desc: "Earn badges for streaks, accuracy, and milestones. Rise through 30 ranks — Rookie to Legend — based on questions answered." },
  { icon: "📤", title: "Shareable Results", desc: "Share your quiz score card on WhatsApp after every CBT mock" },
  { icon: "🎯", title: "Challenge Mode", desc: "Compete with friends in real-time" },
  { icon: "🔗", title: "Refer & Earn", desc: "Invite 2 friends → get 3 days Premium free + leaderboard" },
  { icon: "⚡", title: "Works in Telegram", desc: "No app download — ever" },
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

const reviewJsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "ExamBuddie",
  description: "Past question practice for WAEC, JAMB and NECO on Telegram — timed quizzes, instant AI explanations, and progress tracking.",
  url: "https://exambuddie.app",
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "5",
    bestRating: "5",
    worstRating: "1",
    reviewCount: String(testimonials.length),
  },
  review: testimonials.map(({ quote, name, role }) => ({
    "@type": "Review",
    reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
    author: { "@type": "Person", name },
    reviewBody: quote,
    name: role,
  })),
};

export default function Home() {
  return (
    <div className="font-[var(--font-geist)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewJsonLd) }}
      />

      <ScrollProgress />

      <Nav />

      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-50 to-white px-4 pt-28 pb-16 sm:px-6 sm:pt-32 sm:pb-24 dark:from-slate-900 dark:to-slate-950">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-center lg:gap-16">
            <div className="flex-1 text-center lg:text-left">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700 sm:px-4 sm:text-sm dark:bg-blue-950 dark:text-blue-300">
                🎓 WAEC, JAMB &amp; NECO Prep — Nigeria
              </div>
              <h1 className="mb-5 text-3xl leading-tight font-extrabold tracking-tight text-slate-900 sm:mb-6 sm:text-5xl md:text-6xl dark:text-white">
                Stop guessing. Start acing
                <br />
                <span className="text-blue-700 dark:text-blue-400">WAEC, JAMB &amp; NECO.</span>
              </h1>
              <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-slate-600 sm:mb-10 sm:text-lg md:text-xl lg:mx-0 dark:text-slate-400">
                Practice real past questions, get instant AI explanations, and improve faster
                with personalised learning — all inside Telegram. ExamBuddie doesn&apos;t just test
                you. It trains you until you improve.
              </p>
              <div className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4 lg:justify-start">
                <a
                  href={BOT_URL_LANDING}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-blue-700 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-200 transition-colors hover:bg-blue-800 sm:px-8 sm:py-4 sm:text-lg dark:shadow-none"
                >
                  Start Free — 14 Days Premium →
                </a>
                <a
                  href="#features"
                  className="rounded-full border border-slate-200 px-6 py-3.5 text-base font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 sm:px-8 sm:py-4 sm:text-lg dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                >
                  See how it works
                </a>
              </div>
              <p className="mt-5 text-xs text-slate-400 sm:mt-6 sm:text-sm dark:text-slate-500">
                14 days Premium free · No credit card · No download required
              </p>
            </div>

            <div className="w-full max-w-xs flex-shrink-0 lg:max-w-sm">
              <BotMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Scroll hint */}
      <div className="flex justify-center bg-gradient-to-b from-white to-transparent -mt-8 pb-4 dark:from-slate-950">
        <a
          href="#features"
          className="flex animate-bounce flex-col items-center gap-1 text-slate-400 hover:text-blue-600 dark:text-slate-500 dark:hover:text-blue-400 transition-colors"
          aria-label="Scroll to features"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </a>
      </div>

      {/* Stats bar */}
      <section className="bg-blue-700 py-8 sm:py-10 dark:bg-blue-900">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 px-4 text-center text-white sm:gap-8 sm:px-6 md:grid-cols-4">
          {[
            { value: "41,000+", label: "Past Questions" },
            { value: "12+", label: "Subjects Covered" },
            { value: "WAEC · JAMB · NECO", label: "Exams Covered" },
            { value: "Free", label: "To Start" },
          ].map(({ value, label }) => (
            <div key={label}>
              <div className="whitespace-nowrap text-lg leading-tight font-extrabold sm:text-xl md:text-2xl">
                {value}
              </div>
              <div className="mt-1 text-xs text-blue-200 sm:text-sm">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Problem section */}
      <section className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-20 dark:bg-slate-900">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 text-2xl font-extrabold text-slate-900 sm:text-3xl md:text-4xl dark:text-white">
            Studying hard but scores aren&apos;t improving?
          </h2>
          <p className="mb-10 text-base text-slate-600 sm:text-lg dark:text-slate-400">
            Most students fail not because they don&apos;t study — but because they study the wrong way.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: "📖", problem: "Memorise answers without understanding why" },
              { icon: "🎯", problem: "Don't know which topics are costing them marks" },
              { icon: "🔁", problem: "Repeat the same mistakes in every exam" },
              { icon: "📉", problem: "Practice without feedback or tracking" },
            ].map(({ icon, problem }) => (
              <div key={problem} className="rounded-xl border border-red-100 bg-white p-5 text-left dark:border-red-900/30 dark:bg-slate-950">
                <div className="mb-3 text-2xl">{icon}</div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{problem}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-2xl bg-blue-700 px-6 py-6 text-white sm:px-10">
            <p className="text-base font-bold sm:text-lg">ExamBuddie fixes this.</p>
            <p className="mt-2 text-sm text-blue-100 sm:text-base">
              Every question you answer becomes a learning step. ExamBuddie tracks your mistakes, explains them, and keeps drilling you on them until you get them right.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 sm:mb-20">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">What you get</span>
            <h2 className="mt-2 max-w-2xl text-3xl font-extrabold text-slate-900 sm:text-4xl md:text-5xl dark:text-white">
              Built to get you <span className="text-blue-700 dark:text-blue-400">past the exam</span>
            </h2>
          </div>

          <div className="space-y-20 sm:space-y-28">
            {/* Practice Mode */}
            <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-20">
              <div className="flex-1">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">📚 Practice Mode</span>
                <h3 className="mt-3 text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">
                  41,000 past questions.<br />Every answer explained.
                </h3>
                <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-400">
                  Real WAEC, JAMB and NECO questions at your own pace. Instant explanations after every answer — not just which option is correct, but <em>why</em>.
                </p>
                <ul className="mt-6 space-y-2.5">
                  {["Questions from 2010–2025", "Explanations for every option", "No time pressure — learn at your pace"].map(item => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-400">
                      <span className="text-green-500 font-bold">✓</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="w-full flex-shrink-0 lg:w-96">
                <div className="rounded-2xl bg-slate-900 p-5 shadow-2xl ring-1 ring-slate-800">
                  <p className="mb-1 text-[10px] font-semibold text-blue-400">📝 Chemistry · WAEC 2023</p>
                  <p className="mb-4 text-sm font-medium leading-snug text-white">Which gas is produced when dilute HCl reacts with zinc?</p>
                  <div className="space-y-2">
                    {[["A. Oxygen", false], ["B. Hydrogen", true], ["C. Chlorine", false], ["D. Carbon dioxide", false]].map(([opt, correct]) => (
                      <div key={String(opt)} className={`rounded-lg px-3 py-2 text-xs font-medium ${correct ? "bg-green-600 text-white" : "bg-slate-800 text-slate-400"}`}>
                        {String(opt)} {correct && "✓"}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-xl border border-green-900/40 bg-green-950/50 p-3">
                    <p className="text-[10px] font-bold text-green-400">💡 Explanation</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-green-200">Zinc reacts with dilute HCl to produce zinc chloride and hydrogen gas: Zn + 2HCl → ZnCl₂ + H₂↑</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Timed Quiz */}
            <div className="flex flex-col-reverse gap-10 lg:flex-row lg:items-center lg:gap-20">
              <div className="w-full flex-shrink-0 lg:w-96">
                <div className="rounded-2xl bg-slate-900 p-5 shadow-2xl ring-1 ring-slate-800">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">Question 35 / 50</span>
                    <span className="rounded-full bg-red-900/60 px-3 py-1 text-xs font-bold text-red-400">⏱ 41:14 left</span>
                  </div>
                  <div className="mb-4 h-1.5 w-full rounded-full bg-slate-800">
                    <div className="h-1.5 w-[58%] rounded-full bg-blue-600" />
                  </div>
                  <p className="mb-3 text-sm font-medium leading-snug text-white">The speed of light in a vacuum is approximately:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {["A. 3×10⁸ m/s", "B. 3×10⁶ m/s", "C. 3×10¹⁰ m/s", "D. 3×10⁴ m/s"].map((opt, i) => (
                      <div key={opt} className={`rounded-lg px-3 py-2 text-center text-xs font-medium ${i === 0 ? "bg-blue-700 text-white" : "bg-slate-800 text-slate-400"}`}>
                        {opt}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-between text-[10px] text-slate-500">
                    <span>🎯 18 correct so far</span>
                    <span>📊 78% accuracy</span>
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">📋 Timed Quiz</span>
                <h3 className="mt-3 text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">
                  Exam pressure.<br />Without the exam.
                </h3>
                <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-400">
                  50 questions. 60 minutes. Real exam conditions so the actual paper feels like a repeat. Score breakdown and weak spots the moment you finish.
                </p>
                <ul className="mt-6 space-y-2.5">
                  {["Full 60-minute mock exam", "Score breakdown by topic after", "Compare across attempts"].map(item => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-400">
                      <span className="text-green-500 font-bold">✓</span> {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  🔒 Premium feature
                </div>
              </div>
            </div>

            {/* Drill Mode */}
            <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-20">
              <div className="flex-1">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">🎯 Drill Mode</span>
                <h3 className="mt-3 text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">
                  Knows exactly where<br />you&apos;re losing marks.
                </h3>
                <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-400">
                  ExamBuddie tracks every topic you attempt. When your accuracy on Organic Chemistry drops, Drill Mode zeroes in and hammers those questions until the gap closes.
                </p>
                <ul className="mt-6 space-y-2.5">
                  {["Auto-detects weak topics from your history", "Focused repetition until accuracy improves", "Per-topic tracking, not just per-subject"].map(item => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-400">
                      <span className="text-green-500 font-bold">✓</span> {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  🔒 Premium feature
                </div>
              </div>
              <div className="w-full flex-shrink-0 lg:w-96">
                <div className="rounded-2xl bg-slate-900 p-5 shadow-2xl ring-1 ring-slate-800">
                  <p className="mb-4 text-sm font-bold text-white">📊 Your weak topics</p>
                  {[
                    { topic: "Organic Chemistry", pct: 42 },
                    { topic: "Electromagnetic Waves", pct: 55 },
                    { topic: "Genetic Inheritance", pct: 61 },
                  ].map(({ topic, pct }) => (
                    <div key={topic} className="mb-4">
                      <div className="mb-1.5 flex justify-between text-xs">
                        <span className="font-medium text-slate-300">{topic}</span>
                        <span className={`font-bold ${pct < 50 ? "text-red-400" : pct < 65 ? "text-amber-400" : "text-green-400"}`}>{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-800">
                        <div className={`h-1.5 rounded-full ${pct < 50 ? "bg-red-500" : pct < 65 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className="mt-2 rounded-xl bg-blue-700 py-2.5 text-center text-xs font-bold text-white">
                    🎯 Drill Organic Chemistry now
                  </div>
                </div>
              </div>
            </div>

            {/* Challenge Mode */}
            <div className="flex flex-col-reverse gap-10 lg:flex-row lg:items-center lg:gap-20">
              <div className="w-full flex-shrink-0 lg:w-96">
                <div className="rounded-2xl bg-slate-900 p-5 shadow-2xl ring-1 ring-slate-800">
                  <p className="mb-3 text-xs font-semibold text-blue-400">🎯 Challenge Room · 6 players</p>
                  <div className="mb-4 space-y-2">
                    {[
                      { name: "Tobiloba", ready: true, score: 7 },
                      { name: "Halima", ready: true, score: 6 },
                      { name: "Chisom", ready: true, score: 5 },
                      { name: "You", ready: true, score: 8 },
                    ].map(({ name, ready, score }) => (
                      <div key={name} className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${ready ? "bg-green-400" : "bg-slate-600"}`} />
                          <span className={`text-xs font-medium ${name === "You" ? "text-blue-300" : "text-slate-300"}`}>{name}</span>
                        </div>
                        <span className="text-xs font-bold text-white">{score}/10 ✓</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl bg-blue-700 py-2 text-center text-xs font-bold text-white">
                    🏆 You&apos;re in the lead!
                  </div>
                  <p className="mt-3 text-center text-[10px] text-slate-500">Shared via WhatsApp · Room code: AB7X2K</p>
                </div>
              </div>
              <div className="flex-1">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">🎯 Challenge Mode</span>
                <h3 className="mt-3 text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">
                  Study alone no more.<br />Challenge your friends.
                </h3>
                <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-400">
                  Create a challenge room, share the link on WhatsApp, and race your classmates through the same questions. The challenge auto-starts when everyone&apos;s ready.
                </p>
                <ul className="mt-6 space-y-2.5">
                  {[
                    "Share invite link via WhatsApp or Telegram",
                    "Auto-starts when all players mark ready",
                    "Real-time leaderboard at the end",
                    "Anyone can join — free users included",
                  ].map(item => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-400">
                      <span className="text-green-500 font-bold">✓</span> {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  🔒 Create rooms with Premium · Join free
                </div>
              </div>
            </div>
          </div>

          {/* Secondary features */}
          <div className="mt-20 sm:mt-24">
            <p className="mb-8 text-xs font-bold uppercase tracking-widest text-slate-400">Also included</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {secondaryFeatures.map(({ icon, title, desc }) => (
                <div key={title} className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-2 text-2xl">{icon}</div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Zero friction */}
      <section className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-24 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center sm:mb-16">
            <h2 className="mb-3 text-2xl font-extrabold text-slate-900 sm:mb-4 sm:text-3xl md:text-4xl dark:text-white">
              No setup. No excuses.
            </h2>
            <p className="mx-auto max-w-xl text-base text-slate-600 sm:text-lg dark:text-slate-400">
              Your phone is already ready. Open Telegram, tap Start, and your first question is waiting.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4">
            {whyTelegram.map(({ icon, title, desc }) => (
              <div
                key={title}
                className="flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-2xl dark:bg-slate-800">
                  {icon}
                </span>
                <div>
                  <h3 className="mb-1 text-sm font-bold text-slate-900 sm:text-base dark:text-white">{title}</h3>
                  <p className="text-xs leading-relaxed text-slate-600 sm:text-sm dark:text-slate-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-3 text-2xl font-extrabold text-slate-900 sm:mb-4 sm:text-3xl md:text-4xl dark:text-white">
            Up and running in 30 seconds
          </h2>
          <p className="mb-12 text-base text-slate-600 sm:mb-16 sm:text-lg dark:text-slate-400">
            No sign-up forms. No app stores. Just Telegram.
          </p>
          <div className="grid gap-8 sm:grid-cols-3 sm:gap-10">
            {[
              { step: "1", title: "Open Telegram", desc: "Search for @ExamBuddieBot or tap the button below." },
              { step: "2", title: "Pick your subjects", desc: "Choose WAEC, JAMB or NECO and the subjects you're studying." },
              { step: "3", title: "Start practising", desc: "Practice, quiz, or drill — your progress saves automatically." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col items-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-700 text-xl font-extrabold text-white shadow-lg shadow-blue-200 sm:h-14 sm:w-14 sm:text-2xl dark:shadow-none">
                  {step}
                </div>
                <h3 className="mb-2 text-base font-bold text-slate-900 sm:text-lg dark:text-white">{title}</h3>
                <p className="text-sm text-slate-600 sm:text-base dark:text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
          <a
            href={BOT_URL_LANDING}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-10 inline-block rounded-full bg-blue-700 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-200 transition-colors hover:bg-blue-800 sm:mt-12 sm:px-8 sm:py-4 sm:text-lg dark:shadow-none"
          >
            Open ExamBuddie →
          </a>
        </div>
      </section>

      {/* Subjects */}
      <section id="subjects" className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-24 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center sm:mb-16">
            <div className="mb-3 flex items-center justify-center gap-3">
              <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl md:text-4xl dark:text-white">
                All major subjects covered
              </h2>
              <span className="shrink-0 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                {subjects.length} subjects
              </span>
            </div>
            <p className="text-base text-slate-600 sm:text-lg dark:text-slate-400">
              WAEC, JAMB and NECO past questions across every core subject.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-6">
            {subjects.map(({ icon, name }) => (
              <div
                key={name}
                className="flex flex-col items-center gap-2 rounded-xl bg-white p-3 text-center transition-colors hover:bg-blue-50 sm:p-4 border border-slate-100 dark:bg-slate-950 dark:border-slate-800 dark:hover:bg-slate-800"
              >
                <span className="text-2xl sm:text-3xl">{icon}</span>
                <span className="text-xs font-medium text-slate-700 sm:text-sm dark:text-slate-300">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <BillingSection />
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <hr className="border-slate-200 dark:border-slate-800" />
      </div>

      {/* Compare */}
      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center sm:mb-16">
            <h2 className="mb-3 text-2xl font-extrabold text-slate-900 sm:mb-4 sm:text-3xl md:text-4xl dark:text-white">
              Why ExamBuddie beats the alternatives
            </h2>
            <p className="text-base text-slate-600 sm:text-lg dark:text-slate-400">
              Compare how students prepare — and why the bot wins.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:px-6 dark:text-slate-400">Feature</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-blue-700 sm:px-6 dark:text-blue-400">ExamBuddie</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 sm:px-6 dark:text-slate-400">Textbooks</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 sm:px-6 dark:text-slate-400">YouTube</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[
                  ["Past questions (WAEC, JAMB, NECO)", true, true, false],
                  ["Instant answer explanations", true, false, false],
                  ["Progress tracking + exam countdown", true, false, false],
                  ["Timed mock exams", true, false, false],
                  ["Spaced repetition (wrong answers resurface)", true, false, false],
                  ["Streak freeze (protect your streak)", true, false, false],
                  ["Challenge Mode (multiplayer)", true, false, false],
                  ["Referral rewards (invite friends, earn Premium)", true, false, false],
                  ["Works on any phone", true, false, true],
                  ["Works inside Telegram (no new app)", true, false, false],
                  ["Weak-topic targeting", true, false, false],
                  ["14-day free trial on signup", true, false, false],
                  ["Free to start", true, false, true],
                ].map(([feature, eb, tb, yt]) => (
                  <tr key={String(feature)} className="hover:bg-slate-50 dark:hover:bg-slate-900 dark:bg-slate-950">
                    <td className="px-4 py-3.5 font-medium text-slate-700 sm:px-6 dark:text-slate-300">{feature}</td>
                    <td className="px-4 py-3.5 text-center sm:px-6">
                      {eb ? <span className="text-green-500 font-bold text-base">✓</span> : <span className="text-slate-300 dark:text-slate-700">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-center sm:px-6">
                      {tb ? <span className="text-green-500 font-bold text-base">✓</span> : <span className="text-slate-300 dark:text-slate-700">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-center sm:px-6">
                      {yt ? <span className="text-green-500 font-bold text-base">✓</span> : <span className="text-slate-300 dark:text-slate-700">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-24 dark:bg-slate-900">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center sm:mb-16">
            <h2 className="mb-3 text-2xl font-extrabold text-slate-900 sm:mb-4 sm:text-3xl md:text-4xl dark:text-white">
              Frequently asked questions
            </h2>
          </div>
          <FaqAccordion />
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center sm:mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">What people say</span>
            <h2 className="mt-2 text-2xl font-extrabold text-slate-900 sm:text-3xl md:text-4xl dark:text-white">
              Real results from Parents, Students &amp; Teachers
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map(({ quote, name, role }) => (
              <div
                key={name}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="mb-4 flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="h-4 w-4 fill-amber-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                  ))}
                </div>
                <p className="mb-5 flex-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">&ldquo;{quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                    {name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-blue-700 px-4 py-16 text-center text-white sm:px-6 sm:py-24 dark:bg-blue-900">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-3 text-2xl font-extrabold sm:mb-4 sm:text-3xl md:text-4xl">
            Ready to improve your exam score?
          </h2>
          <p className="mb-8 text-base text-blue-100 sm:mb-10 sm:text-lg">
            Start free today — 14 days Premium included, no card needed.
          </p>
          <a
            href={BOT_URL_LANDING}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full bg-white px-8 py-3.5 text-base font-bold text-blue-700 shadow-xl transition-colors hover:bg-blue-50 sm:px-10 sm:py-4 sm:text-lg"
          >
            Start Free on Telegram →
          </a>
          <p className="mt-4 text-xs text-blue-200 sm:text-sm">
            No download. No sign-up. Open Telegram and go.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 px-4 py-8 pb-24 sm:px-6 sm:py-10 md:pb-10 dark:border-slate-800">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="flex flex-col items-center justify-between gap-3 text-center text-xs text-slate-500 sm:gap-4 sm:text-sm md:flex-row md:text-left dark:text-slate-400">
            <a href="#" className="text-sm font-bold text-slate-700 hover:text-blue-700 sm:text-base dark:text-slate-200 dark:hover:text-blue-400">ExamBuddie</a>
            <div className="flex flex-col items-center gap-1">
              <span>© {new Date().getFullYear()} ExamBuddie. All Rights Reserved.</span>
              <span>Built with ❤️ for Nigerian students.</span>
            </div>
            <a
              href={BOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-700 hover:underline dark:text-blue-400"
            >
              Open in Telegram →
            </a>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500 md:justify-start dark:text-slate-400">
            <a href="/privacy" className="hover:text-blue-700 hover:underline dark:hover:text-blue-400">Privacy Policy</a>
            <a href="/terms" className="hover:text-blue-700 hover:underline dark:hover:text-blue-400">Terms of Use</a>
            <a href="/refunds" className="hover:text-blue-700 hover:underline dark:hover:text-blue-400">Refund Policy</a>
          </div>
        </div>
      </footer>

      {/* Sticky mobile CTA */}
      <div className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3 dark:border-slate-800 dark:bg-slate-950/95">
        <a
          href={BOT_URL_LANDING}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-full bg-blue-700 py-3.5 text-center text-sm font-bold text-white shadow-lg shadow-blue-200/50 transition-colors hover:bg-blue-800 dark:shadow-none"
        >
          Start Practising Free on Telegram →
        </a>
      </div>
    </div>
  );
}
