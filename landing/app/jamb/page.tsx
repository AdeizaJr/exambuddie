import type { Metadata } from "next";
import { Nav } from "../components/Nav";

const BOT_URL_JAMB = "https://t.me/ExamBuddieBot?start=from_jamb";

export const metadata: Metadata = {
  title: "JAMB UTME Past Questions 2010–2025: Practice on Telegram | ExamBuddie",
  description:
    "Practice 10,000+ real JAMB UTME past questions across all subjects. CBT-style timed mock exams, instant AI explanations, and weak-topic drilling. Free to start on Telegram.",
  keywords: [
    "JAMB past questions",
    "JAMB UTME practice questions",
    "JAMB 2026 questions",
    "JAMB past questions with answers",
    "JAMB mathematics past questions",
    "JAMB English past questions",
    "JAMB biology past questions",
    "JAMB chemistry past questions",
    "JAMB physics past questions",
    "UTME prep Nigeria",
    "JAMB prep Telegram bot",
    "JAMB past questions 2010 to 2025",
    "JAMB CBT practice",
  ],
  alternates: { canonical: "/jamb" },
  openGraph: {
    title: "JAMB UTME Past Questions: Practice Free on Telegram | ExamBuddie",
    description:
      "10,000+ real JAMB UTME past questions with instant AI explanations. CBT-style timed exams, weak-topic drill mode. All inside Telegram.",
    type: "website",
    url: "https://exambuddie.app/jamb",
    siteName: "ExamBuddie",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "ExamBuddie: JAMB UTME Practice on Telegram" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "JAMB UTME Past Questions: Practice Free on Telegram | ExamBuddie",
    description: "10,000+ real JAMB UTME past questions with instant AI explanations. Free to start.",
    images: ["/opengraph-image"],
  },
};

const jambSubjects = [
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
  { icon: "🏛️", name: "Government", slug: "government" },
  { icon: "📚", name: "Literature", slug: "literature" },
];

const jambJsonLd = {
  "@context": "https://schema.org",
  "@type": "Course",
  name: "JAMB UTME Past Questions Practice: ExamBuddie",
  description: "Practice real JAMB UTME past questions from 2010 to 2025 with instant AI explanations, CBT-style timed exams, and weak-topic drill mode.",
  provider: {
    "@type": "Organization",
    name: "ExamBuddie",
    url: "https://exambuddie.app",
  },
  url: "https://exambuddie.app/jamb",
  educationalLevel: "Secondary School",
  teaches: "JAMB UTME exam preparation: Mathematics, English, Sciences, Humanities",
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

export default function JambPage() {
  return (
    <div className="font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jambJsonLd) }}
      />

      <Nav />

      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-50 to-white px-4 pt-28 pb-16 sm:px-6 sm:pt-32 sm:pb-24 dark:from-slate-900 dark:to-slate-950">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700 sm:px-4 sm:text-sm dark:bg-blue-950 dark:text-blue-300">
            🎓 JAMB UTME Preparation · Nigeria
          </div>
          <h1 className="mb-5 text-3xl leading-tight font-bold tracking-tight text-slate-900 sm:mb-6 sm:text-5xl md:text-6xl dark:text-white">
            JAMB UTME Past Questions
            <br />
            <span className="text-blue-700 dark:text-blue-400">2010–2025, Free on Telegram.</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-slate-600 sm:mb-10 sm:text-lg md:text-xl dark:text-slate-400">
            Practice real JAMB past questions in a CBT-style environment directly in Telegram. Timed mock exams, instant AI explanations, and personalised weak-topic drilling: exactly what UTME candidates need.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <a
              href={BOT_URL_JAMB}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-blue-700 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-200 transition-colors hover:bg-blue-800 sm:px-8 sm:py-4 sm:text-lg dark:shadow-none"
            >
              Start JAMB Practice Free →
            </a>
          </div>
          <p className="mt-5 text-xs text-slate-500 sm:mt-6 sm:text-sm dark:text-slate-400">
            14 days Premium free · No credit card · No download required
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-blue-700 py-8 sm:py-10 dark:bg-blue-900">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 px-4 text-center text-white sm:gap-8 sm:px-6 md:grid-cols-4">
          {[
            { value: "10,000+", label: "JAMB Questions" },
            { value: "2010–2025", label: "Years Covered" },
            { value: "CBT Style", label: "Timed Exams" },
            { value: "Free", label: "To Start" },
          ].map(({ value, label }) => (
            <div key={label}>
              <div className="text-lg leading-tight font-bold sm:text-xl md:text-2xl">{value}</div>
              <div className="mt-1 text-xs text-blue-200 sm:text-sm">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* JAMB-specific features */}
      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-4 text-center text-2xl font-bold text-slate-900 sm:text-3xl md:text-4xl dark:text-white">
            Built for JAMB UTME success
          </h2>
          <p className="mb-12 text-center text-base text-slate-600 sm:text-lg dark:text-slate-400">
            JAMB is CBT-based, time-pressured, and tests 4 subjects at once. ExamBuddie trains you for exactly that.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "⏱️",
                title: "CBT-style timed mock exams",
                desc: "50 questions, 60 minutes: the same pressure as the real UTME. Score breakdown by subject and topic when you finish.",
              },
              {
                icon: "📚",
                title: "Practice all 4 UTME subjects",
                desc: "Mix your 4 chosen JAMB subjects in a single session, or drill each separately to target specific weak areas.",
              },
              {
                icon: "💡",
                title: "AI explanations for every question",
                desc: "JAMB questions are notoriously tricky. ExamBuddie explains the reasoning step by step so you understand, not just memorise.",
              },
              {
                icon: "🔁",
                title: "Spaced repetition on wrong answers",
                desc: "Questions you get wrong resurface at the right intervals until you answer correctly: proven to lock in long-term recall.",
              },
              {
                icon: "📅",
                title: "UTME countdown timer",
                desc: "See exactly how many days remain until your UTME exam date, visible every time you check /stats.",
              },
              {
                icon: "🏆",
                title: "Challenge your study group",
                desc: "Create a challenge room, share the link on WhatsApp, and compete with your classmates on real JAMB past questions.",
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
          <h2 className="mb-4 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
            All JAMB subjects covered
          </h2>
          <p className="mb-10 text-base text-slate-600 sm:text-lg dark:text-slate-400">
            Practice your 4 UTME subjects with real past questions and explanations.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-6">
            {jambSubjects.map(({ icon, name, slug }) =>
              slug ? (
                <a
                  key={name}
                  href={`/jamb/${slug}`}
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
          <h2 className="mb-3 text-2xl font-bold sm:mb-4 sm:text-3xl md:text-4xl">
            Start your JAMB UTME prep today
          </h2>
          <p className="mb-8 text-base text-blue-100 sm:mb-10 sm:text-lg">
            Free for 14 days. No card. No download. Just Telegram.
          </p>
          <a
            href={BOT_URL_JAMB}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full bg-white px-8 py-3.5 text-base font-bold text-blue-700 shadow-xl transition-colors hover:bg-blue-50 sm:px-10 sm:py-4 sm:text-lg"
          >
            Start JAMB Practice Free →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 px-4 py-8 sm:px-6 sm:py-10 dark:border-slate-800">
        <div className="mx-auto max-w-6xl flex flex-col items-center justify-between gap-3 text-center text-xs text-slate-500 sm:gap-4 sm:text-sm md:flex-row md:text-left dark:text-slate-400">
          <a href="/" className="text-sm font-bold text-slate-700 hover:text-blue-700 sm:text-base dark:text-slate-200 dark:hover:text-blue-400">ExamBuddie</a>
          <div className="flex flex-col items-center gap-1">
            <span>© {new Date().getFullYear()} ExamBuddie. All Rights Reserved.</span>
            <span>Built with ❤️ for Nigerian students.</span>
          </div>
          <div className="flex gap-4">
            <a href="/waec" className="hover:text-blue-700 dark:hover:text-blue-400">WAEC →</a>
            <a href="/neco" className="hover:text-blue-700 dark:hover:text-blue-400">NECO →</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
