import type { Metadata } from "next";
import { Nav } from "../components/Nav";

const BOT_URL_WAEC = "https://t.me/ExamBuddieBot?start=from_waec";

export const metadata: Metadata = {
  title: "WAEC Past Questions 2010–2025 — Practice on Telegram | ExamBuddie",
  description:
    "Practice 30,000+ real WAEC past questions across all major subjects. Instant AI explanations, timed mock exams, and progress tracking — free to start on Telegram.",
  keywords: [
    "WAEC past questions",
    "WAEC practice questions",
    "WAEC 2026 questions",
    "WAEC past questions with answers",
    "WAEC mathematics past questions",
    "WAEC biology past questions",
    "WAEC chemistry past questions",
    "WAEC English past questions",
    "WAEC physics past questions",
    "WAEC revision Nigeria",
    "WAEC prep Telegram bot",
    "WAEC past questions 2010 to 2025",
  ],
  alternates: { canonical: "/waec" },
  openGraph: {
    title: "WAEC Past Questions — Practice Free on Telegram | ExamBuddie",
    description:
      "30,000+ real WAEC past questions with instant AI explanations. Timed mock exams, weak-topic drill mode, and daily streaks — all inside Telegram.",
    type: "website",
    url: "https://exambuddie.app/waec",
    siteName: "ExamBuddie",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "ExamBuddie — WAEC Past Questions on Telegram" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "WAEC Past Questions — Practice Free on Telegram | ExamBuddie",
    description: "30,000+ real WAEC past questions with instant AI explanations. Free to start.",
    images: ["/opengraph-image"],
  },
};

const waecSubjects = [
  { icon: "📐", name: "Mathematics", slug: "math" },
  { icon: "📖", name: "English Language", slug: "english" },
  { icon: "🔬", name: "Biology", slug: "biology" },
  { icon: "⚗️", name: "Chemistry", slug: "chemistry" },
  { icon: "⚡", name: "Physics", slug: "physics" },
  { icon: "🌍", name: "Geography", slug: "geography" },
  { icon: "💰", name: "Economics", slug: "economics" },
  { icon: "📊", name: "Accounts", slug: "accounts" },
  { icon: "📜", name: "History", slug: null },
  { icon: "✝️", name: "CRK / IRK", slug: null },
  { icon: "🌱", name: "Agric Science", slug: "agric" },
  { icon: "🏛️", name: "Government", slug: "government" },
];

const waecJsonLd = {
  "@context": "https://schema.org",
  "@type": "Course",
  name: "WAEC Past Questions Practice — ExamBuddie",
  description: "Practice real WAEC past questions from 2010 to 2025 across all major subjects with instant AI explanations and progress tracking.",
  provider: {
    "@type": "Organization",
    name: "ExamBuddie",
    url: "https://exambuddie.app",
  },
  url: "https://exambuddie.app/waec",
  educationalLevel: "Secondary School",
  teaches: "WAEC exam preparation — Mathematics, English, Sciences, Humanities",
  datePublished: "2024-01-01",
  dateModified: "2026-06-01",
  inLanguage: "en-NG",
  isAccessibleForFree: true,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "NGN",
    availability: "https://schema.org/InStock",
  },
};

export default function WaecPage() {
  return (
    <div className="font-[var(--font-geist)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(waecJsonLd) }}
      />

      <Nav />

      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-50 to-white px-4 pt-28 pb-16 sm:px-6 sm:pt-32 sm:pb-24 dark:from-slate-900 dark:to-slate-950">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700 sm:px-4 sm:text-sm dark:bg-blue-950 dark:text-blue-300">
            📝 WAEC Past Questions — Nigeria
          </div>
          <h1 className="mb-5 text-3xl leading-tight font-extrabold tracking-tight text-slate-900 sm:mb-6 sm:text-5xl md:text-6xl dark:text-white">
            WAEC Past Questions
            <br />
            <span className="text-blue-700 dark:text-blue-400">2010–2025, All Subjects.</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-slate-600 sm:mb-10 sm:text-lg md:text-xl dark:text-slate-400">
            Practice real WAEC past questions directly in Telegram. Every question has an instant AI explanation — not just the answer, but <strong>why</strong>. Track your progress, spot weak topics, and drill them until you improve.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <a
              href={BOT_URL_WAEC}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-blue-700 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-200 transition-colors hover:bg-blue-800 sm:px-8 sm:py-4 sm:text-lg dark:shadow-none"
            >
              Start WAEC Practice Free →
            </a>
          </div>
          <p className="mt-5 text-xs text-slate-400 sm:mt-6 sm:text-sm dark:text-slate-500">
            14 days Premium free · No credit card · No download required
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-blue-700 py-8 sm:py-10 dark:bg-blue-900">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 px-4 text-center text-white sm:gap-8 sm:px-6 md:grid-cols-4">
          {[
            { value: "30,000+", label: "WAEC Questions" },
            { value: "2010–2025", label: "Years Covered" },
            { value: "12", label: "Subjects" },
            { value: "Free", label: "To Start" },
          ].map(({ value, label }) => (
            <div key={label}>
              <div className="text-lg leading-tight font-extrabold sm:text-xl md:text-2xl">{value}</div>
              <div className="mt-1 text-xs text-blue-200 sm:text-sm">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Why ExamBuddie for WAEC */}
      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-4 text-center text-2xl font-extrabold text-slate-900 sm:text-3xl md:text-4xl dark:text-white">
            The smartest way to prepare for WAEC
          </h2>
          <p className="mb-12 text-center text-base text-slate-600 sm:text-lg dark:text-slate-400">
            Not just a question bank — an intelligent system that adapts to where you&apos;re losing marks.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "💡",
                title: "Explanations after every question",
                desc: "WAEC examiners test understanding, not memorisation. ExamBuddie explains the reasoning behind every correct answer so you actually learn.",
              },
              {
                icon: "🎯",
                title: "Drill weak topics automatically",
                desc: "When your accuracy on a topic drops, ExamBuddie targets it automatically until you improve. No manual subject selection needed.",
              },
              {
                icon: "📋",
                title: "Full 60-minute mock exams",
                desc: "Simulate real WAEC conditions — 50 questions, 60 minutes. See your score breakdown by topic the moment you finish.",
              },
              {
                icon: "📅",
                title: "WAEC exam countdown",
                desc: "See exactly how many days remain until your WAEC. Pair it with a daily streak to build a consistent study habit.",
              },
              {
                icon: "🔁",
                title: "Spaced repetition",
                desc: "Questions you got wrong resurface at the right interval — the scientifically proven method to move knowledge into long-term memory.",
              },
              {
                icon: "🏆",
                title: "Challenge your classmates",
                desc: "Create a WAEC challenge room, share the link on WhatsApp, and race your friends through real past questions.",
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-3 text-3xl">{icon}</div>
                <h3 className="mb-2 text-base font-bold text-slate-900 dark:text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Subjects */}
      <section className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-24 dark:bg-slate-900">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">
            All WAEC subjects covered
          </h2>
          <p className="mb-10 text-base text-slate-600 sm:text-lg dark:text-slate-400">
            Past questions for every core WAEC subject, with explanations.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-6">
            {waecSubjects.map(({ icon, name, slug }) =>
              slug ? (
                <a
                  key={name}
                  href={`/waec/${slug}`}
                  className="flex flex-col items-center gap-2 rounded-xl bg-white p-3 text-center border border-slate-100 transition-colors hover:border-blue-200 hover:bg-blue-50 dark:bg-slate-950 dark:border-slate-800 dark:hover:border-blue-800 dark:hover:bg-blue-950"
                >
                  <span className="text-2xl sm:text-3xl">{icon}</span>
                  <span className="text-xs font-medium text-slate-700 sm:text-sm dark:text-slate-300">{name}</span>
                </a>
              ) : (
                <div
                  key={name}
                  className="flex flex-col items-center gap-2 rounded-xl bg-white p-3 text-center border border-slate-100 dark:bg-slate-950 dark:border-slate-800"
                >
                  <span className="text-2xl sm:text-3xl">{icon}</span>
                  <span className="text-xs font-medium text-slate-700 sm:text-sm dark:text-slate-300">{name}</span>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-700 px-4 py-16 text-center text-white sm:px-6 sm:py-24 dark:bg-blue-900">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-3 text-2xl font-extrabold sm:mb-4 sm:text-3xl md:text-4xl">
            Start your WAEC prep today
          </h2>
          <p className="mb-8 text-base text-blue-100 sm:mb-10 sm:text-lg">
            Free for 14 days. No card. No download. Just Telegram.
          </p>
          <a
            href={BOT_URL_WAEC}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full bg-white px-8 py-3.5 text-base font-bold text-blue-700 shadow-xl transition-colors hover:bg-blue-50 sm:px-10 sm:py-4 sm:text-lg"
          >
            Start WAEC Practice Free →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 px-4 py-8 sm:px-6 sm:py-10 dark:border-slate-800">
        <div className="mx-auto max-w-6xl flex flex-col items-center justify-between gap-3 text-center text-xs text-slate-500 sm:gap-4 sm:text-sm md:flex-row md:text-left dark:text-slate-400">
          <a href="/" className="text-sm font-bold text-slate-700 hover:text-blue-700 sm:text-base dark:text-slate-200 dark:hover:text-blue-400">ExamBuddie</a>
          <span>© {new Date().getFullYear()} ExamBuddie. Built for Nigerian students.</span>
          <div className="flex gap-4">
            <a href="/jamb" className="hover:text-blue-700 dark:hover:text-blue-400">JAMB →</a>
            <a href="/neco" className="hover:text-blue-700 dark:hover:text-blue-400">NECO →</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
