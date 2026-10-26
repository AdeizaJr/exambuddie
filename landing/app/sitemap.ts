import type { MetadataRoute } from "next";
import { posts } from "./data/posts";
import { subjects } from "./data/subjects";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://exambuddie.app";

  const blogEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(post.updated ?? post.date),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const waecSubjectEntries: MetadataRoute.Sitemap = subjects
    .filter((s) => s.waec !== null)
    .map((s) => ({
      url: `${base}/waec/${s.slug}`,
      lastModified: new Date(s.updatedAt),
      changeFrequency: "monthly",
      priority: 0.85,
    }));

  const jambSubjectEntries: MetadataRoute.Sitemap = subjects
    .filter((s) => s.jamb !== null)
    .map((s) => ({
      url: `${base}/jamb/${s.slug}`,
      lastModified: new Date(s.updatedAt),
      changeFrequency: "monthly",
      priority: 0.85,
    }));

  const necoSubjectEntries: MetadataRoute.Sitemap = subjects
    .filter((s) => s.neco !== null)
    .map((s) => ({
      url: `${base}/neco/${s.slug}`,
      lastModified: new Date(s.updatedAt),
      changeFrequency: "monthly",
      priority: 0.85,
    }));

  // Hub/legal pages have no per-entry CMS date to pull from — these are each
  // page's actual last-touched date (from git log), not a shared placeholder.
  // Bump the relevant one by hand whenever that page's content changes.
  return [
    { url: base, lastModified: new Date("2026-07-11"), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/waec`, lastModified: new Date("2026-07-10"), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/jamb`, lastModified: new Date("2026-07-10"), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/neco`, lastModified: new Date("2026-07-10"), changeFrequency: "monthly", priority: 0.9 },
    ...waecSubjectEntries,
    ...jambSubjectEntries,
    ...necoSubjectEntries,
    { url: `${base}/blog`, lastModified: new Date("2026-07-06"), changeFrequency: "weekly", priority: 0.8 },
    ...blogEntries,
    { url: `${base}/privacy`, lastModified: new Date("2026-07-06"), changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: new Date("2026-07-06"), changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/refunds`, lastModified: new Date("2026-07-06"), changeFrequency: "yearly", priority: 0.3 },
  ];
}
