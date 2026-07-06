import type { Metadata } from "next";
import { Nav } from "../components/Nav";
import { posts } from "../data/posts";

export const metadata: Metadata = {
  title: "Exam Prep Blog: WAEC, JAMB & NECO Study Tips | ExamBuddie",
  description:
    "Study guides, past question strategies, and exam tips for Nigerian students preparing for WAEC, JAMB, and NECO.",
  keywords: [
    "WAEC study tips",
    "JAMB preparation guide",
    "NECO study guide",
    "Nigerian exam prep blog",
    "how to pass WAEC",
    "how to score high in JAMB",
  ],
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Exam Prep Blog: WAEC, JAMB & NECO Study Tips | ExamBuddie",
    description: "Study guides, past question strategies, and exam tips for Nigerian students.",
    type: "website",
    url: "https://exambuddie.app/blog",
    siteName: "ExamBuddie",
  },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}

export default function BlogIndex() {
  return (
    <div className="font-[var(--font-geist)]">
      <Nav />

      <section className="bg-gradient-to-b from-blue-50 to-white px-4 pt-28 pb-16 sm:px-6 sm:pt-32 sm:pb-20 dark:from-slate-900 dark:to-slate-950">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            📚 Exam Prep
          </div>
          <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Study guides for WAEC, JAMB &amp; NECO
          </h1>
          <p className="text-base text-slate-600 sm:text-lg dark:text-slate-400">
            Practical tips, strategies, and past question breakdowns to help you score higher.
          </p>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-3xl space-y-6">
          {posts.map((post) => (
            <a
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block rounded-2xl border border-slate-200 bg-white p-6 transition-colors hover:border-blue-200 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-800 dark:hover:bg-slate-800"
            >
              <div className="mb-2 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <time dateTime={post.date}>{formatDate(post.date)}</time>
                <span>·</span>
                <span>{post.readingMinutes} min read</span>
              </div>
              <h2 className="mb-2 text-lg font-bold text-slate-900 sm:text-xl dark:text-white">
                {post.title}
              </h2>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {post.description}
              </p>
              <span className="mt-4 inline-block text-sm font-semibold text-blue-700 dark:text-blue-400">
                Read guide →
              </span>
            </a>
          ))}
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
            <a href="/waec" className="hover:text-blue-700 dark:hover:text-blue-400">WAEC</a>
            <a href="/jamb" className="hover:text-blue-700 dark:hover:text-blue-400">JAMB</a>
            <a href="/neco" className="hover:text-blue-700 dark:hover:text-blue-400">NECO</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
