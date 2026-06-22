import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Nav } from "../../components/Nav";
import { posts, type Block } from "../../data/posts";

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post) return {};

  return {
    title: `${post.title} | ExamBuddie`,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      url: `https://exambuddie.app/blog/${post.slug}`,
      siteName: "ExamBuddie",
      publishedTime: post.date,
      images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: ["/opengraph-image"],
    },
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}

function renderBlock(block: Block, i: number) {
  switch (block.type) {
    case "h2":
      return <h2 key={i} className="mt-10 mb-4 text-xl font-extrabold text-slate-900 sm:text-2xl dark:text-white">{block.text}</h2>;
    case "h3":
      return <h3 key={i} className="mt-7 mb-3 text-lg font-bold text-slate-900 dark:text-white">{block.text}</h3>;
    case "p":
      return <p key={i} className="mb-5 text-base leading-relaxed text-slate-700 dark:text-slate-300">{block.text}</p>;
    case "ul":
      return (
        <ul key={i} className="mb-5 space-y-2 pl-1">
          {block.items.map((item, j) => (
            <li key={j} className="flex items-start gap-3 text-base text-slate-700 dark:text-slate-300">
              <span className="mt-1 text-blue-600 font-bold shrink-0">•</span>
              {item}
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={i} className="mb-5 space-y-2 pl-1">
          {block.items.map((item, j) => (
            <li key={j} className="flex items-start gap-3 text-base text-slate-700 dark:text-slate-300">
              <span className="shrink-0 font-bold text-blue-600">{j + 1}.</span>
              {item}
            </li>
          ))}
        </ol>
      );
    case "callout":
      return (
        <div key={i} className="my-6 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 dark:border-blue-800 dark:bg-blue-950/40">
          <p className="text-sm font-medium leading-relaxed text-blue-800 dark:text-blue-200">{block.text}</p>
        </div>
      );
    case "cta":
      return (
        <div key={i} className="my-8 text-center">
          <a
            href={block.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full bg-blue-700 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-200 transition-colors hover:bg-blue-800 dark:shadow-none"
          >
            {block.text}
          </a>
        </div>
      );
  }
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post) notFound();

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: {
      "@type": "Organization",
      name: "ExamBuddie",
      url: "https://exambuddie.app",
    },
    publisher: {
      "@type": "Organization",
      name: "ExamBuddie",
      url: "https://exambuddie.app",
      logo: { "@type": "ImageObject", url: "https://exambuddie.app/opengraph-image" },
    },
    url: `https://exambuddie.app/blog/${post.slug}`,
    inLanguage: "en-NG",
    keywords: post.keywords.join(", "),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://exambuddie.app" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://exambuddie.app/blog" },
      { "@type": "ListItem", position: 3, name: post.title, item: `https://exambuddie.app/blog/${post.slug}` },
    ],
  };

  return (
    <div className="font-[var(--font-geist)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <Nav />

      <article className="px-4 pt-28 pb-16 sm:px-6 sm:pt-32 sm:pb-24">
        <div className="mx-auto max-w-3xl">
          {/* Breadcrumb */}
          <nav className="mb-8 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <a href="/" className="hover:text-blue-700 dark:hover:text-blue-400">Home</a>
            <span>›</span>
            <a href="/blog" className="hover:text-blue-700 dark:hover:text-blue-400">Blog</a>
            <span>›</span>
            <span className="text-slate-700 dark:text-slate-300 line-clamp-1">{post.title}</span>
          </nav>

          {/* Meta */}
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span>·</span>
            <span>{post.readingMinutes} min read</span>
          </div>

          {/* Title */}
          <h1 className="mb-6 text-2xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            {post.title}
          </h1>

          <p className="mb-8 text-base leading-relaxed text-slate-500 dark:text-slate-400 border-b border-slate-200 pb-8 dark:border-slate-800">
            {post.description}
          </p>

          {/* Content */}
          <div>
            {post.blocks.map((block, i) => renderBlock(block, i))}
          </div>

          {/* Back to blog */}
          <div className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-800">
            <a href="/blog" className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-400">
              ← Back to all guides
            </a>
          </div>
        </div>
      </article>

      <footer className="border-t border-slate-100 px-4 py-8 sm:px-6 sm:py-10 dark:border-slate-800">
        <div className="mx-auto max-w-6xl flex flex-col items-center justify-between gap-3 text-center text-xs text-slate-500 sm:gap-4 sm:text-sm md:flex-row md:text-left dark:text-slate-400">
          <a href="/" className="text-sm font-bold text-slate-700 hover:text-blue-700 sm:text-base dark:text-slate-200 dark:hover:text-blue-400">ExamBuddie</a>
          <span>© {new Date().getFullYear()} ExamBuddie. Built for Nigerian students.</span>
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
