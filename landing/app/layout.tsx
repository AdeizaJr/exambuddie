import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { faqs } from "./data/faqs";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  metadataBase: new URL("https://exambuddie.app"),
  title: "ExamBuddie: Ace WAEC, JAMB & NECO on Telegram",
  verification: { google: "googleb86b6e207e3f7ae9" },
  description:
    "WAEC, JAMB and NECO past questions practice on Telegram, with timed quizzes, instant explanations, and progress tracking. Free to start.",
  keywords: [
    "WAEC past questions",
    "JAMB practice questions",
    "NECO past questions",
    "Nigerian exam prep",
    "WAEC prep Telegram",
    "JAMB prep app",
    "exam preparation Nigeria",
    "WAEC 2026",
    "JAMB 2026",
    "secondary school exam questions Nigeria",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "ExamBuddie: Ace WAEC, JAMB & NECO on Telegram",
    description:
      "Practice 41,000+ past WAEC, JAMB and NECO questions directly in Telegram. Timed quizzes, instant explanations, and progress tracking.",
    type: "website",
    url: "https://exambuddie.app",
    siteName: "ExamBuddie",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "ExamBuddie: Ace WAEC, JAMB & NECO on Telegram",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ExamBuddie: Ace WAEC, JAMB & NECO on Telegram",
    description:
      "Practice 41,000+ past WAEC, JAMB and NECO questions directly in Telegram. Free to start.",
    images: ["/opengraph-image"],
  },
};

const softwareAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "ExamBuddie",
  applicationCategory: "EducationApplication",
  operatingSystem: "Telegram",
  url: "https://exambuddie.app",
  description:
    "Past question practice for WAEC, JAMB and NECO, with timed quizzes, instant explanations, and progress tracking on Telegram.",
  datePublished: "2024-01-01",
  dateModified: "2026-06-01",
  offers: [
    { "@type": "Offer", price: "0", priceCurrency: "NGN", name: "Free" },
    { "@type": "Offer", price: "1500", priceCurrency: "NGN", name: "Premium Monthly" },
    { "@type": "Offer", price: "3500", priceCurrency: "NGN", name: "Premium 3-Month" },
    { "@type": "Offer", price: "12000", priceCurrency: "NGN", name: "Premium Yearly" },
  ],
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "ExamBuddie",
  url: "https://exambuddie.app",
  logo: "https://exambuddie.app/opengraph-image",
  description:
    "Past question practice platform for WAEC, JAMB and NECO exams, with timed drills, instant explanations, and streak tracking, accessible directly inside Telegram.",
  foundingDate: "2024",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "hello@exambuddie.app",
  },
  areaServed: "NG",
  knowsLanguage: "en-NG",
  sameAs: [
    "https://x.com/exambuddie",
    "https://linkedin.com/company/exambuddie",
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: {
      "@type": "Answer",
      text: a,
    },
  })),
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "ExamBuddie",
  url: "https://exambuddie.app",
  description: "WAEC, JAMB and NECO past question practice on Telegram.",
  inLanguage: "en-NG",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://exambuddie.app/blog?q={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
};

const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={`${geist.variable} scroll-smooth`} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#1D4ED8" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://t.me" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body className="bg-white text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
