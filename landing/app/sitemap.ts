import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://exambuddie.app";

  return [
    { url: base, lastModified: new Date("2026-06-01"), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/waec`, lastModified: new Date("2026-06-01"), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/jamb`, lastModified: new Date("2026-06-01"), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/neco`, lastModified: new Date("2026-06-01"), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/privacy`, lastModified: new Date("2025-01-01"), changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: new Date("2025-01-01"), changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/refunds`, lastModified: new Date("2025-01-01"), changeFrequency: "yearly", priority: 0.3 },
  ];
}
