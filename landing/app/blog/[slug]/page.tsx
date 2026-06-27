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
    case "related":
      return (
        <div key={i} className="my-8 rounded-2xl border border-blue-100 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950/40">
          <p className="mb-4 text-sm font-semibold text-blue-800 dark:text-blue-300">Related guides</p>
          <div className="flex flex-wrap gap-3">
            {block.items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-950"
              >
                {item.text} →
              </a>
            ))}
          </div>
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
    image: "https://exambuddie.app/opengraph-image",
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

          {/* Share + Back */}
          <div className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-800 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <a href="/blog" className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-400">
              ← Back to all guides
            </a>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${post.title}\n\nhttps://exambuddie.app/blog/${post.slug}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 transition-colors hover:bg-green-100 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-900/40"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Share on WhatsApp
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
