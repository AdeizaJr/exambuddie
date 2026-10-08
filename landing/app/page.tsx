import { ScrollProgress } from "./components/ScrollProgress";
import { Nav } from "./components/Nav";
import { BotMockup } from "./components/BotMockup";
import { BillingSection } from "./components/BillingSection";
import { FaqAccordion } from "./components/FaqAccordion";
import { testimonials } from "./data/testimonials";
import { getPricing } from "./lib/pricing";
import {
  GraduationCapIcon, BrainIcon, TargetIcon, RepeatIcon, TrendDownIcon,
  BookmarkIcon, ChartBarIcon, RulerIcon, CalendarIcon, LayersIcon, FlameIcon,
  MedalIcon, ShareIcon, LinkIcon, BoltIcon, PhoneIcon, DevicesIcon, SyncIcon,
  DnaIcon, FlaskIcon, AtomIcon, BookOpenIcon, GlobeIcon, ScrollIcon, CoinsIcon,
  BookHeartIcon, LeafIcon, ColumnsIcon,
} from "./components/icons";

const BOT_URL = "https://t.me/ExamBuddieBot";
const BOT_URL_LANDING = "https://t.me/ExamBuddieBot?start=from_landing";

const subjects = [
  { icon: RulerIcon, name: "Mathematics", slug: "math" },
  { icon: DnaIcon, name: "Biology", slug: "biology" },
  { icon: FlaskIcon, name: "Chemistry", slug: "chemistry" },
  { icon: AtomIcon, name: "Physics", slug: "physics" },
  { icon: BookOpenIcon, name: "English Language", slug: "english" },
  { icon: GlobeIcon, name: "Geography", slug: "geography" },
  { icon: ScrollIcon, name: "History", slug: null },
  { icon: CoinsIcon, name: "Economics", slug: "economics" },
  { icon: ChartBarIcon, name: "Accounts", slug: "accounts" },
  { icon: BookHeartIcon, name: "CRK / IRK", slug: "crk" },
  { icon: LeafIcon, name: "Agric Science", slug: "agric" },
  { icon: ColumnsIcon, name: "Government", slug: "government" },
];

const secondaryFeatures = [
  { icon: RepeatIcon, title: "Revision Mode", desc: "Practice only the questions you previously got wrong (/revision)" },
  { icon: BookmarkIcon, title: "Bookmark Questions", desc: "Save any question mid-practice and drill your bookmarks later" },
  { icon: ChartBarIcon, title: "Progress Stats", desc: "Daily target, accuracy by topic, and exam countdown (/stats)" },
  { icon: RulerIcon, title: "Formula Sheets", desc: "Instant formula reference for Physics, Chemistry, Maths, Economics, Government (/formula)" },
  { icon: CalendarIcon, title: "Exam Timetable", desc: "2026 WAEC/NECO/JAMB subject dates with countdown (/timetable)" },
  { icon: LayersIcon, title: "Multi-Subject", desc: "Mix subjects in one practice session (Premium)" },
  { icon: FlameIcon, title: "Study Streaks", desc: "Build a daily habit, freeze your streak once a week (Premium)" },
  { icon: RepeatIcon, title: "Spaced Repetition", desc: "Wrong answers resurface until you master them (/review)" },
  { icon: CalendarIcon, title: "Daily Question", desc: "Question of the Day broadcast every morning with your exam type" },
  { icon: MedalIcon, title: "Achievements & Ranks", desc: "Earn badges for streaks, accuracy, and milestones. Rise through 30 ranks, Rookie to Legend, based on questions answered." },
  { icon: ShareIcon, title: "Shareable Results", desc: "Share your quiz score card on WhatsApp after every CBT mock" },
  { icon: TargetIcon, title: "Challenge Mode", desc: "Compete with friends in real-time" },
  { icon: LinkIcon, title: "Refer & Earn", desc: "Invite 2 friends → get 3 days Premium free + leaderboard" },
  { icon: BoltIcon, title: "Works in Telegram", desc: "No app download, ever" },
];

// Bento layout for the "Also included" grid: these cards take half the row on
// desktop, the rest take a third, giving rows of 2, 3, 2, 3, 2.
const BENTO_WIDE = new Set([0, 1, 5, 6, 10, 11]);

const whyTelegram = [
  {
    icon: PhoneIcon,
    title: "No download needed",
    desc: "If you have Telegram, you're ready. No app store, no install, no storage space used.",
  },
  {
    icon: DevicesIcon,
    title: "Works on any device",
    desc: "Android, iPhone, or desktop, ExamBuddie works everywhere Telegram does.",
  },
  {
    icon: BoltIcon,
    title: "Zero setup",
    desc: "Tap Start, pick your subjects, and your first question arrives in under 30 seconds.",
  },
  {
    icon: SyncIcon,
    title: "Progress always synced",
    desc: "Switch devices and your stats, streak, and history are always up to date.",
  },
];

const reviewJsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "ExamBuddie",
  description: "Past question practice for WAEC, JAMB and NECO on Telegram, with timed quizzes, instant AI explanations, and progress tracking.",
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

export default async function Home() {
  const pricing = await getPricing();
  return (
    <div className="font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewJsonLd) }}
      />

      <ScrollProgress />

      <Nav />

      {/* Hero */}
      <section className="relative isolate overflow-hidden px-4 pt-28 pb-16 sm:px-6 sm:pt-36 sm:pb-24">
        {/* Decorative backdrop: soft wash, faint grid, brand glow behind the phone */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-50 via-white to-white dark:from-slate-900 dark:via-slate-950 dark:to-slate-950" />
          <div className="hero-grid absolute inset-0" />
          <div className="absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-blue-400/25 blur-3xl lg:left-[72%] dark:bg-blue-600/20" />
        </div>

        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-center lg:gap-16">
            <div className="flex-1 text-center lg:text-left">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/70 px-3 py-1.5 text-xs font-medium text-blue-700 backdrop-blur sm:px-4 sm:text-sm dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300">
                <GraduationCapIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                WAEC, JAMB &amp; NECO Prep · Nigeria
              </div>
              <h1 className="mb-5 text-4xl leading-[1.08] font-bold text-slate-900 text-balance sm:mb-6 sm:text-5xl md:text-6xl dark:text-white">
                Stop guessing. Start acing
                <br />
                <span className="bg-gradient-to-r from-blue-700 to-sky-500 bg-clip-text text-transparent dark:from-blue-400 dark:to-sky-300">
                  WAEC, JAMB &amp; NECO.
                </span>
              </h1>
              <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-slate-600 sm:mb-10 sm:text-lg md:text-xl lg:mx-0 dark:text-slate-400">
                Practice real past questions, get instant AI explanations, and improve faster
                with personalised learning, all inside Telegram. ExamBuddie doesn&apos;t just test
                you. It trains you until you improve.
              </p>
              <div className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4 lg:justify-start">
                <a
                  href={BOT_URL_LANDING}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-blue-700 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5 hover:bg-blue-800 hover:shadow-xl hover:shadow-blue-600/30 sm:px-8 sm:py-4 sm:text-lg dark:shadow-none"
                >
                  Start Free · 14 Days Premium →
                </a>
                <a
                  href="#features"
                  className="rounded-full border border-slate-200 bg-white/70 px-6 py-3.5 text-base font-semibold text-slate-700 backdrop-blur transition-colors hover:border-slate-300 hover:bg-white sm:px-8 sm:py-4 sm:text-lg dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                >
                  See how it works
                </a>
              </div>
              <p className="mt-5 text-xs text-slate-500 sm:mt-6 sm:text-sm dark:text-slate-400">
                14 days Premium free · No credit card · No download required
              </p>
            </div>

            <div className="w-full max-w-xs flex-shrink-0 lg:max-w-sm">
              <BotMockup />
            </div>
          </div>

          {/* Stats */}
          <dl className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:mt-20 md:grid-cols-4 dark:border-slate-800 dark:bg-slate-800">
            {[
              { value: "41,000+", label: "Past Questions" },
              { value: "16", label: "Subjects Covered" },
              { value: "3", label: "Exam Boards" },
              { value: "Free", label: "To Start" },
            ].map(({ value, label }) => (
              <div key={label} className="flex flex-col-reverse bg-white px-4 py-5 text-center sm:py-6 dark:bg-slate-950">
                <dt className="mt-1 text-xs text-slate-500 sm:text-sm dark:text-slate-400">{label}</dt>
                <dd className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums sm:text-3xl dark:text-white">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Problem section */}
      <section className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-20 dark:bg-slate-900">
        <div className="mx-auto max-w-4xl reveal text-center">
          <h2 className="mb-4 text-2xl font-bold text-slate-900 text-balance sm:text-3xl md:text-4xl dark:text-white">
            Studying hard but scores aren&apos;t improving?
          </h2>
          <p className="mb-10 text-base text-slate-600 sm:text-lg dark:text-slate-400">
            Most students fail not because they don&apos;t study, but because they study the wrong way.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { Icon: BrainIcon, problem: "Memorise answers without understanding why" },
              { Icon: TargetIcon, problem: "Don't know which topics are costing them marks" },
              { Icon: RepeatIcon, problem: "Repeat the same mistakes in every exam" },
              { Icon: TrendDownIcon, problem: "Practice without feedback or tracking" },
            ].map(({ Icon, problem }) => (
              <div key={problem} className="rounded-xl border border-red-100 bg-white p-5 text-left dark:border-red-900/30 dark:bg-slate-950">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-500 dark:bg-red-950/40 dark:text-red-400">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{problem}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-2xl bg-blue-800 px-6 py-6 text-white sm:px-10 dark:bg-blue-900">
            <p className="text-base font-bold sm:text-lg">ExamBuddie fixes this.</p>
            <p className="mt-2 text-sm text-blue-200/90 sm:text-base">
              Every question you answer becomes a learning step. ExamBuddie tracks your mistakes, explains them, and keeps drilling you on them until you get them right.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl reveal">
          <div className="mb-16 sm:mb-20">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">What you get</span>
            <h2 className="mt-2 max-w-2xl text-3xl font-bold text-slate-900 sm:text-4xl md:text-5xl dark:text-white">
              Built to get you <span className="text-blue-700 dark:text-blue-400">past the exam</span>
            </h2>
          </div>

          <div className="space-y-20 sm:space-y-28">
            {/* Practice Mode */}
            <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-20">
              <div className="flex-1">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">📚 Practice Mode</span>
                <h3 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
                  41,000 past questions.<br />Every answer explained.
                </h3>
                <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-400">
                  Real WAEC, JAMB and NECO questions at your own pace. Instant explanations after every answer, not just which option is correct, but <em>why</em>.
                </p>
                <ul className="mt-6 space-y-2.5">
                  {["Questions from 2010–2025", "Explanations for every option", "No time pressure, learn at your pace"].map(item => (
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
                <h3 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
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
                <h3 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
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
                <h3 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
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
                    "Anyone can join, free users included",
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
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-6">
              {secondaryFeatures.map(({ icon: Icon, title, desc }, i) => (
                <div
                  key={title}
                  className={`group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-600/5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-800 ${
                    BENTO_WIDE.has(i) ? "lg:col-span-3" : "lg:col-span-2"
                  }`}
                >
                  <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition-colors group-hover:bg-blue-700 group-hover:text-white dark:bg-blue-950 dark:text-blue-300">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-semibold text-slate-900 sm:text-base dark:text-white">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm dark:text-slate-400">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Zero friction */}
      <section className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-24 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl reveal">
          <div className="mb-10 text-center sm:mb-16">
            <h2 className="mb-3 text-2xl font-bold text-slate-900 sm:mb-4 sm:text-3xl md:text-4xl dark:text-white">
              No setup. No excuses.
            </h2>
            <p className="mx-auto max-w-xl text-base text-slate-600 sm:text-lg dark:text-slate-400">
              Your phone is already ready. Open Telegram, tap Start, and your first question is waiting.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4">
            {whyTelegram.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-600/5 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-800"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <Icon className="h-5 w-5" aria-hidden="true" />
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
      <section className="relative isolate overflow-hidden bg-slate-950 px-4 py-16 text-white sm:px-6 sm:py-24">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-48 left-1/2 h-[28rem] w-[48rem] max-w-none -translate-x-1/2 rounded-full bg-blue-600/25 blur-3xl" />
        </div>
        <div className="mx-auto max-w-4xl text-center reveal">
          <h2 className="mb-3 text-2xl font-bold sm:mb-4 sm:text-3xl md:text-4xl">
            Up and running in 30 seconds
          </h2>
          <p className="mb-12 text-base text-slate-400 sm:mb-16 sm:text-lg">
            No sign-up forms. No app stores. Just Telegram.
          </p>
          <ol className="relative grid gap-8 sm:grid-cols-3 sm:gap-10">
            {/* Line joining the three step circles on wider screens */}
            <li aria-hidden="true" className="absolute top-7 right-[16.67%] left-[16.67%] hidden h-px bg-gradient-to-r from-blue-500/0 via-blue-500/60 to-blue-500/0 sm:block" />
            {[
              { step: "1", title: "Open Telegram", desc: "Search for @ExamBuddieBot or tap the button below." },
              { step: "2", title: "Pick your subjects", desc: "Choose WAEC, JAMB or NECO and the subjects you're studying." },
              { step: "3", title: "Start practising", desc: "Practice, quiz, or drill, your progress saves automatically." },
            ].map(({ step, title, desc }) => (
              <li key={step} className="relative flex flex-col items-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white ring-8 ring-slate-950 sm:h-14 sm:w-14 sm:text-2xl">
                  {step}
                </div>
                <h3 className="mb-2 text-base font-semibold sm:text-lg">{title}</h3>
                <p className="text-sm text-slate-400 sm:text-base">{desc}</p>
              </li>
            ))}
          </ol>
          <a
            href={BOT_URL_LANDING}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-10 inline-block rounded-full bg-white px-7 py-3.5 text-base font-semibold text-blue-700 transition hover:-translate-y-0.5 hover:bg-blue-50 sm:mt-12 sm:px-8 sm:py-4 sm:text-lg"
          >
            Open ExamBuddie →
          </a>
        </div>
      </section>

      {/* Subjects */}
      <section id="subjects" className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-24 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl reveal">
          <div className="mb-10 text-center sm:mb-16">
            <div className="mb-3 flex items-center justify-center gap-3">
              <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl md:text-4xl dark:text-white">
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
            {subjects.map(({ icon: Icon, name, slug }) => {
              const className = "flex flex-col items-center gap-2 rounded-2xl bg-white p-3 text-center transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-600/5 sm:p-4 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 dark:hover:border-blue-800";
              const content = (
                <>
                  <Icon className="h-7 w-7 text-blue-700 sm:h-8 sm:w-8 dark:text-blue-400" aria-hidden="true" />
                  <span className="text-xs font-medium text-slate-700 sm:text-sm dark:text-slate-300">{name}</span>
                </>
              );
              return slug ? (
                <a key={name} href={`/waec/${slug}`} className={className}>{content}</a>
              ) : (
                <div key={name} className={className}>{content}</div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl reveal">
          <BillingSection pricing={pricing} />
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <hr className="border-slate-200 dark:border-slate-800" />
      </div>

      {/* Compare */}
      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl reveal">
          <div className="mb-10 text-center sm:mb-16">
            <h2 className="mb-3 text-2xl font-bold text-slate-900 sm:mb-4 sm:text-3xl md:text-4xl dark:text-white">
              Why ExamBuddie beats the alternatives
            </h2>
            <p className="text-base text-slate-600 sm:text-lg dark:text-slate-400">
              Compare how students prepare, and why the bot wins.
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:px-6 dark:text-slate-400">Feature</th>
                  <th className="bg-blue-50 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-blue-700 sm:px-6 dark:bg-blue-950/50 dark:text-blue-400">ExamBuddie</th>
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
                    <td className="bg-blue-50/60 px-4 py-3.5 text-center sm:px-6 dark:bg-blue-950/30">
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

      {/* Origin Story */}
      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16 reveal">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">Our story</span>
            <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl md:text-4xl dark:text-white">
              How ExamBuddie started
            </h2>
            <div className="mt-6 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                A
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Alhassan Adeiza Hassan</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Founder, ExamBuddie</p>
              </div>
            </div>
          </div>
          <div className="space-y-5 border-l-2 border-blue-200 pl-6 text-base leading-relaxed text-slate-600 sm:text-lg dark:border-blue-900 dark:text-slate-400">
            <p>
              I served my NYSC year teaching Basic Science, Technology, and Physics at a secondary
              school. When exam season came around, I got to see up close how my students actually
              prepared for WAEC, NECO, and JAMB.
            </p>
            <p>
              It wasn&apos;t great. One past-questions booklet would get passed around a group of three
              or four students, each waiting their turn. Some copies were so worn from reuse that parts
              of the print had faded out completely, so students were half-guessing what the original
              text even said. A few students skipped the booklets altogether and just Googled around for
              answers on random websites.
            </p>
            <p>
              What got me was that every one of these students had a smartphone on them. None of them
              were short on internet access. They just didn&apos;t have anything worth using once they
              were online, nothing built for what they actually needed.
            </p>
            <p>
              That&apos;s the gap ExamBuddie fills: past questions and explanations a student can pull up
              on their own phone in seconds, instead of waiting for a shared booklet or trusting whatever
              a random forum told them.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-24 dark:bg-slate-900">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center sm:mb-16">
            <h2 className="mb-3 text-2xl font-bold text-slate-900 sm:mb-4 sm:text-3xl md:text-4xl dark:text-white">
              Frequently asked questions
            </h2>
          </div>
          <FaqAccordion />
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl reveal">
          <div className="mb-10 text-center sm:mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">What people say</span>
            <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl md:text-4xl dark:text-white">
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
      <section className="px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 to-blue-900 px-6 py-14 text-center text-white sm:px-10 sm:py-20 reveal">
          <div aria-hidden="true" className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-80 w-[40rem] max-w-none -translate-x-1/2 rounded-full bg-sky-400/30 blur-3xl" />
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-3 text-2xl font-bold sm:mb-4 sm:text-3xl md:text-4xl">
              Ready to improve your exam score?
            </h2>
            <p className="mb-8 text-base text-blue-100 sm:mb-10 sm:text-lg">
              Start free today, 14 days Premium included, no card needed.
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
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 px-4 py-8 pb-24 sm:px-6 sm:py-10 md:pb-10 dark:border-slate-800">
        <div className="mx-auto max-w-6xl">
          {/* Top row: brand + social icons */}
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            {/* Brand */}
            <div className="flex flex-col items-center gap-1 md:items-start">
              <a href="#" className="text-lg font-bold text-slate-800 hover:text-blue-700 dark:text-white dark:hover:text-blue-400">ExamBuddie</a>
              <p className="text-sm text-slate-400 dark:text-slate-500">Built with ❤️ for Nigerian students.</p>
            </div>
            {/* Social icons + email */}
            <div className="flex flex-col items-center gap-2 md:items-end">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">Contact us</p>
            <div className="flex items-center gap-3">
              <a href="https://x.com/exambuddiebot" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-white">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a href="https://www.instagram.com/exambuddiebot" target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-white">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
                </svg>
              </a>
              <a href="https://www.tiktok.com/@exambuddiebot" target="_blank" rel="noopener noreferrer" aria-label="TikTok"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-white">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                </svg>
              </a>
              <a href="https://linkedin.com/company/exambuddie" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-white">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
              <a href="mailto:hello@exambuddie.app" aria-label="Email"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
              </a>
            </div>
            </div>
          </div>
          {/* Bottom row: legal links + copyright */}
          <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-6 md:flex-row dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-400 md:justify-start dark:text-slate-500">
              <a href="/privacy" className="hover:text-blue-600 hover:underline dark:hover:text-blue-400">Privacy Policy</a>
              <a href="/terms" className="hover:text-blue-600 hover:underline dark:hover:text-blue-400">Terms of Use</a>
              <a href="/refunds" className="hover:text-blue-600 hover:underline dark:hover:text-blue-400">Refund Policy</a>
            </div>
            <p className="text-sm text-slate-400 dark:text-slate-500">© {new Date().getFullYear()} ExamBuddie. All Rights Reserved.</p>
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
