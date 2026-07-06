import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Nav } from "../../components/Nav";
import { subjects } from "../../data/subjects";

export function generateStaticParams() {
  return subjects
    .filter((s) => s.jamb !== null)
    .map((s) => ({ subject: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subject: string }>;
}): Promise<Metadata> {
  const { subject } = await params;
  const s = subjects.find((x) => x.slug === subject);
  if (!s || !s.jamb) return {};

  return {
    title: `JAMB ${s.displayName} Past Questions 2010–2025 | ExamBuddie`,
    description: `Practice ${s.jamb.count}+ real JAMB UTME ${s.displayName} past questions with answers and explanations. CBT-style timed mock exams, topic drills, and progress tracking. Free on Telegram.`,
    keywords: [
      `JAMB ${s.displayName} past questions`,
      `JAMB ${s.displayName} past questions with answers`,
      `JAMB ${s.displayName} 2026`,
      `${s.displayName} JAMB UTME revision`,
      `JAMB ${s.displayName} topics`,
      `${s.displayName} past questions Nigeria`,
    ],
    alternates: { canonical: `/jamb/${s.slug}` },
    openGraph: {
      title: `JAMB ${s.displayName} Past Questions 2010–2025 | ExamBuddie`,
      description: `Practice ${s.jamb.count}+ real JAMB UTME ${s.displayName} past questions with answers and explanations. Free on Telegram.`,
      type: "website",
      url: `https://exambuddie.app/jamb/${s.slug}`,
      siteName: "ExamBuddie",
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: `ExamBuddie: JAMB ${s.displayName} Past Questions` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `JAMB ${s.displayName} Past Questions 2010–2025 | ExamBuddie`,
      description: `Practice ${s.jamb.count}+ real JAMB UTME ${s.displayName} past questions with answers and explanations. Free on Telegram.`,
      images: ["/opengraph-image"],
    },
  };
}

export default async function JambSubjectPage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject } = await params;
  const s = subjects.find((x) => x.slug === subject);

  if (!s || !s.jamb) {
    notFound();
  }

  const startParam = s.slug.replace(/-/g, "_");
  const botUrl = `https://t.me/ExamBuddieBot?start=from_jamb_${startParam}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: `JAMB UTME ${s.displayName} Past Questions Practice: ExamBuddie`,
    description: `Practice ${s.jamb.count}+ real JAMB UTME ${s.displayName} past questions from 2010 to 2025 with instant AI explanations and CBT-style timed mock exams.`,
    provider: {
      "@type": "Organization",
      name: "ExamBuddie",
      url: "https://exambuddie.app",
    },
    url: `https://exambuddie.app/jamb/${s.slug}`,
    educationalLevel: "Secondary School",
    teaches: `JAMB UTME ${s.displayName}: ${s.topics.slice(0, 4).join(", ")}`,
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
      { "@type": "ListItem", position: 2, name: "JAMB", item: "https://exambuddie.app/jamb" },
      { "@type": "ListItem", position: 3, name: `JAMB ${s.displayName}`, item: `https://exambuddie.app/jamb/${s.slug}` },
    ],
  };

  const faqItems = [
    {
      q: `How many JAMB ${s.displayName} past questions are on ExamBuddie?`,
      a: `ExamBuddie has ${s.jamb.count}+ real JAMB UTME ${s.displayName} past questions from 2010 to 2025, covering ${s.topics.length} major topics: ${s.topics.join(", ")}.`,
    },
    {
      q: `Is ExamBuddie free for JAMB ${s.displayName} practice?`,
      a: "Yes. ExamBuddie is free to start with 14 days of Premium access included. No credit card or app download required: practice CBT-style directly inside Telegram.",
    },
    {
      q: `Which topics does JAMB ${s.displayName} cover?`,
      a: `JAMB UTME ${s.displayName} covers ${s.topics.join(", ")}.`,
    },
    {
      q: `Can I practise JAMB ${s.displayName} CBT on my phone?`,
      a: "Yes. ExamBuddie simulates CBT conditions inside Telegram, which runs on any smartphone. No download needed.",
    },
    {
      q: `Does ExamBuddie explain JAMB ${s.displayName} answers?`,
      a: `Yes. Every JAMB ${s.displayName} question has a step-by-step explanation so you understand the reasoning, not just the correct answer.`,
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
    <div className="font-[var(--font-geist)]">
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
            🎓 JAMB UTME Past Questions · {s.displayName}
          </div>
          <h1 className="mb-5 text-3xl leading-tight font-extrabold tracking-tight text-slate-900 sm:mb-6 sm:text-5xl md:text-6xl dark:text-white">
            JAMB {s.displayName} Past Questions
            <br />
            <span className="text-blue-700 dark:text-blue-400">2010–2025, Free on Telegram.</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-slate-600 sm:mb-10 sm:text-lg md:text-xl dark:text-slate-400">
            {s.blurb} Practice CBT-style in Telegram with instant AI explanations, timed UTME mock exams, and personalised weak-topic drilling.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <a
              href={botUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-blue-700 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-200 transition-colors hover:bg-blue-800 sm:px-8 sm:py-4 sm:text-lg dark:shadow-none"
            >
              Start JAMB {s.displayName} Practice Free →
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
            { value: `${s.jamb.count}+`, label: "JAMB Questions" },
            { value: "CBT Style", label: "Timed Exams" },
            { value: `${s.topics.length}`, label: "Topics" },
            { value: "Free", label: "To Start" },
          ].map(({ value, label }) => (
            <div key={label}>
              <div className="text-lg leading-tight font-extrabold sm:text-xl md:text-2xl">{value}</div>
              <div className="mt-1 text-xs text-blue-200 sm:text-sm">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-24 dark:bg-slate-900">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">
            Topics covered in JAMB {s.displayName}
          </h2>
          <p className="mb-10 text-base text-slate-600 sm:text-lg dark:text-slate-400">
            Past questions across all major JAMB UTME {s.displayName} topics, with full explanations.
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
          <h2 className="mb-4 text-center text-2xl font-extrabold text-slate-900 sm:text-3xl md:text-4xl dark:text-white">
            Built for JAMB {s.displayName} success
          </h2>
          <p className="mb-12 text-center text-base text-slate-600 sm:text-lg dark:text-slate-400">
            JAMB is CBT-based, time-pressured, and demands accuracy. ExamBuddie trains you for exactly that.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "⏱️",
                title: "CBT-style timed mock exams",
                desc: `Timed ${s.displayName} questions in the same CBT format as real UTME. Full score breakdown by topic when you finish.`,
              },
              {
                icon: "💡",
                title: "AI explanations for every question",
                desc: `JAMB ${s.displayName} questions are notoriously tricky. ExamBuddie explains the reasoning step by step so you understand, not just memorise.`,
              },
              {
                icon: "🎯",
                title: "Drill weak topics automatically",
                desc: `When your accuracy on a ${s.displayName} topic drops, ExamBuddie targets it automatically until you improve.`,
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
                desc: `Create a challenge room, share the link on WhatsApp, and compete with your classmates on real JAMB ${s.displayName} past questions.`,
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

      {(s.waec || s.neco) && (
        <section className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-24 dark:bg-slate-900">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="mb-4 text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">
              Also practise {s.displayName} for other exams
            </h2>
            <p className="mb-10 text-base text-slate-600 sm:text-lg dark:text-slate-400">
              ExamBuddie covers {s.displayName} past questions across all major Nigerian exams.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {s.waec && (
                <a
                  href={`/waec/${s.slug}`}
                  className="rounded-full border border-blue-200 bg-white px-6 py-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-950 dark:text-blue-300 dark:hover:bg-blue-950"
                >
                  WAEC {s.displayName} Past Questions →
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
          <h2 className="mb-10 text-center text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">
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
          <h2 className="mb-3 text-2xl font-extrabold sm:mb-4 sm:text-3xl md:text-4xl">
            Start JAMB {s.displayName} practice today
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
            Start JAMB {s.displayName} Practice Free →
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
