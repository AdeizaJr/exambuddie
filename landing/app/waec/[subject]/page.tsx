import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Nav } from "../../components/Nav";
import { subjects } from "../../data/subjects";

export function generateStaticParams() {
  return subjects
    .filter((s) => s.waec !== null)
    .map((s) => ({ subject: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subject: string }>;
}): Promise<Metadata> {
  const { subject } = await params;
  const s = subjects.find((x) => x.slug === subject);
  if (!s || !s.waec) return {};

  return {
    title: `WAEC ${s.displayName} Past Questions 2010–2025 | ExamBuddie`,
    description: `Practice ${s.waec.count}+ real WAEC ${s.displayName} past questions with answers and explanations. Timed mock exams, topic drills, and progress tracking. Free on Telegram.`,
    keywords: [
      `WAEC ${s.displayName} past questions`,
      `WAEC ${s.displayName} past questions with answers`,
      `WAEC ${s.displayName} 2027`,
      `${s.displayName} WAEC revision`,
      `WAEC ${s.displayName} topics`,
      `${s.displayName} past questions Nigeria`,
    ],
    alternates: { canonical: `/waec/${s.slug}` },
    openGraph: {
      title: `WAEC ${s.displayName} Past Questions 2010–2025 | ExamBuddie`,
      description: `Practice ${s.waec.count}+ real WAEC ${s.displayName} past questions with answers and explanations. Free on Telegram.`,
      type: "website",
      url: `https://exambuddie.app/waec/${s.slug}`,
      siteName: "ExamBuddie",
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: `ExamBuddie: WAEC ${s.displayName} Past Questions` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `WAEC ${s.displayName} Past Questions 2010–2025 | ExamBuddie`,
      description: `Practice ${s.waec.count}+ real WAEC ${s.displayName} past questions with answers and explanations. Free on Telegram.`,
      images: ["/opengraph-image"],
    },
  };
}

export default async function WaecSubjectPage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject } = await params;
  const s = subjects.find((x) => x.slug === subject);

  if (!s || !s.waec) {
    notFound();
  }

  const startParam = s.slug.replace(/-/g, "_");
  const botUrl = `https://t.me/ExamBuddieBot?start=from_waec_${startParam}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: `WAEC ${s.displayName} Past Questions Practice: ExamBuddie`,
    description: `Practice ${s.waec.count}+ real WAEC ${s.displayName} past questions from 2010 to 2025 with instant AI explanations and progress tracking.`,
    provider: {
      "@type": "Organization",
      name: "ExamBuddie",
      url: "https://exambuddie.app",
    },
    url: `https://exambuddie.app/waec/${s.slug}`,
    educationalLevel: "Secondary School",
    teaches: `WAEC ${s.displayName}: ${s.topics.slice(0, 4).join(", ")}`,
    datePublished: "2024-01-01",
    dateModified: "2026-06-25",
    inLanguage: "en-NG",
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "NGN",
      availability: "https://schema.org/InStock",
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://exambuddie.app" },
      { "@type": "ListItem", position: 2, name: "WAEC", item: "https://exambuddie.app/waec" },
      { "@type": "ListItem", position: 3, name: `WAEC ${s.displayName}`, item: `https://exambuddie.app/waec/${s.slug}` },
    ],
  };

  const faqItems = [
    {
      q: `How many WAEC ${s.displayName} past questions are on ExamBuddie?`,
      a: `ExamBuddie has ${s.waec.count}+ real WAEC ${s.displayName} past questions from 2010 to 2025, covering ${s.topics.length} major topics: ${s.topics.join(", ")}.`,
    },
    {
      q: `Is ExamBuddie free for WAEC ${s.displayName} practice?`,
      a: "Yes. ExamBuddie is free to start with 14 days of Premium access included. No credit card or app download required: practice directly inside Telegram.",
    },
    {
      q: `Which topics does WAEC ${s.displayName} cover?`,
      a: `WAEC ${s.displayName} covers ${s.topics.join(", ")}.`,
    },
    {
      q: `Can I practice WAEC ${s.displayName} on my phone?`,
      a: "Yes. ExamBuddie works inside Telegram, which runs on any smartphone. No download needed: just open Telegram and start practising.",
    },
    {
      q: `Does ExamBuddie explain WAEC ${s.displayName} answers?`,
      a: `Yes. Every WAEC ${s.displayName} question has a full explanation so you understand why the correct answer is right, not just what it is.`,
    },
  ];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <div className="font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <Nav />

      <section className="bg-gradient-to-b from-blue-50 to-white px-4 pt-28 pb-16 sm:px-6 sm:pt-32 sm:pb-24 dark:from-slate-900 dark:to-slate-950">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700 sm:px-4 sm:text-sm dark:bg-blue-950 dark:text-blue-300">
            📝 WAEC Past Questions · {s.displayName}
          </div>
          <h1 className="mb-5 text-3xl leading-tight font-bold tracking-tight text-slate-900 sm:mb-6 sm:text-5xl md:text-6xl dark:text-white">
            WAEC {s.displayName} Past Questions
            <br />
            <span className="text-blue-700 dark:text-blue-400">2010–2025, Free on Telegram.</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-slate-600 sm:mb-10 sm:text-lg md:text-xl dark:text-slate-400">
            {s.blurb} Practice real past questions directly in Telegram with instant AI explanations, timed mock exams, and smart progress tracking.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <a
              href={botUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-blue-700 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-200 transition-colors hover:bg-blue-800 sm:px-8 sm:py-4 sm:text-lg dark:shadow-none"
            >
              Start WAEC {s.displayName} Practice Free →
            </a>
          </div>
          <p className="mt-5 text-xs text-slate-400 sm:mt-6 sm:text-sm dark:text-slate-500">
            14 days Premium free · No credit card · No download required
          </p>
        </div>
      </section>

      <section className="bg-blue-700 py-8 sm:py-10 dark:bg-blue-900">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 px-4 text-center text-white sm:gap-8 sm:px-6 md:grid-cols-4">
          {[
            { value: `${s.waec.count}+`, label: "WAEC Questions" },
            { value: "2010–2025", label: "Years Covered" },
            { value: `${s.topics.length}`, label: "Topics" },
            { value: "Free", label: "To Start" },
          ].map(({ value, label }) => (
            <div key={label}>
              <div className="text-lg leading-tight font-bold sm:text-xl md:text-2xl">{value}</div>
              <div className="mt-1 text-xs text-blue-200 sm:text-sm">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-24 dark:bg-slate-900">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
            Topics covered in WAEC {s.displayName}
          </h2>
          <p className="mb-10 text-base text-slate-600 sm:text-lg dark:text-slate-400">
            Past questions across all major WAEC {s.displayName} topics, with full explanations.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {s.topics.map((topic) => (
              <span
                key={topic}
                className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-4 text-center text-2xl font-bold text-slate-900 sm:text-3xl md:text-4xl dark:text-white">
            The smartest way to prepare for WAEC {s.displayName}
          </h2>
          <p className="mb-12 text-center text-base text-slate-600 sm:text-lg dark:text-slate-400">
            Not just a question bank: an intelligent system that targets your weak spots.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "💡",
                title: "Explanations after every question",
                desc: `WAEC ${s.displayName} questions test understanding. ExamBuddie explains the reasoning behind every correct answer so you actually learn.`,
              },
              {
                icon: "🎯",
                title: "Drill weak topics automatically",
                desc: `When your accuracy on a ${s.displayName} topic drops, ExamBuddie targets it automatically until you improve.`,
              },
              {
                icon: "📋",
                title: "Full 60-minute mock exams",
                desc: `Simulate real WAEC ${s.displayName} conditions: timed questions with a full score breakdown by topic the moment you finish.`,
              },
              {
                icon: "🔁",
                title: "Spaced repetition",
                desc: "Questions you got wrong resurface at the right interval: the scientifically proven method to move knowledge into long-term memory.",
              },
              {
                icon: "📅",
                title: "WAEC exam countdown",
                desc: "See exactly how many days remain until your WAEC exam. Pair it with a daily streak to build a consistent study habit.",
              },
              {
                icon: "🏆",
                title: "Challenge your classmates",
                desc: `Create a WAEC ${s.displayName} challenge room, share the link on WhatsApp, and race your friends through real past questions.`,
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

      {(s.jamb || s.neco) && (
        <section className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-24 dark:bg-slate-900">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="mb-4 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
              Also practise {s.displayName} for other exams
            </h2>
            <p className="mb-10 text-base text-slate-600 sm:text-lg dark:text-slate-400">
              ExamBuddie covers {s.displayName} past questions across all major Nigerian exams.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {s.jamb && (
                <a
                  href={`/jamb/${s.slug}`}
                  className="rounded-full border border-blue-200 bg-white px-6 py-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-950 dark:text-blue-300 dark:hover:bg-blue-950"
                >
                  JAMB {s.displayName} Past Questions →
                </a>
              )}
              {s.neco && (
                <a
                  href={`/neco/${s.slug}`}
                  className="rounded-full border border-blue-200 bg-white px-6 py-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-950 dark:text-blue-300 dark:hover:bg-blue-950"
                >
                  NECO {s.displayName} Past Questions →
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-10 text-center text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {faqItems.map(({ q, a }) => (
              <details
                key={q}
                className="group rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 font-semibold text-slate-900 dark:text-white">
                  {q}
                  <span className="shrink-0 text-blue-600 transition-transform group-open:rotate-180">▾</span>
                </summary>
                <p className="px-6 pb-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-blue-700 px-4 py-16 text-center text-white sm:px-6 sm:py-24 dark:bg-blue-900">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-3 text-2xl font-bold sm:mb-4 sm:text-3xl md:text-4xl">
            Start WAEC {s.displayName} practice today
          </h2>
          <p className="mb-8 text-base text-blue-100 sm:mb-10 sm:text-lg">
            Free for 14 days. No card. No download. Just Telegram.
          </p>
          <a
            href={botUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full bg-white px-8 py-3.5 text-base font-bold text-blue-700 shadow-xl transition-colors hover:bg-blue-50 sm:px-10 sm:py-4 sm:text-lg"
          >
            Start WAEC {s.displayName} Practice Free →
          </a>
        </div>
      </section>

      <footer className="border-t border-slate-100 px-4 py-8 sm:px-6 sm:py-10 dark:border-slate-800">
        <div className="mx-auto max-w-6xl flex flex-col items-center justify-between gap-3 text-center text-xs text-slate-500 sm:gap-4 sm:text-sm md:flex-row md:text-left dark:text-slate-400">
          <a href="/" className="text-sm font-bold text-slate-700 hover:text-blue-700 sm:text-base dark:text-slate-200 dark:hover:text-blue-400">ExamBuddie</a>
          <div className="flex flex-col items-center gap-1">
            <span>© {new Date().getFullYear()} ExamBuddie. All Rights Reserved.</span>
            <span>Built with ❤️ for Nigerian students.</span>
          </div>
          <div className="flex gap-4">
            <a href="/waec" className="hover:text-blue-700 dark:hover:text-blue-400">WAEC →</a>
            <a href="/jamb" className="hover:text-blue-700 dark:hover:text-blue-400">JAMB →</a>
            <a href="/neco" className="hover:text-blue-700 dark:hover:text-blue-400">NECO →</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
