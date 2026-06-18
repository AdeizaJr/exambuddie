import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { faqs } from "./data/faqs";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  metadataBase: new URL("https://exambuddie.app"),
  title: "ExamBuddie — Ace WAEC, JAMB & NECO on Telegram",
  description:
    "AI-powered exam prep for WAEC, JAMB and NECO — practice past questions directly in Telegram. Timed quizzes, instant explanations, and progress tracking — free to start.",
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
    title: "ExamBuddie — Ace WAEC, JAMB & NECO on Telegram",
    description:
      "AI-powered exam prep for WAEC, JAMB and NECO — practice past questions directly in Telegram. Timed quizzes, instant explanations, and progress tracking.",
    type: "website",
    url: "https://exambuddie.app",
    siteName: "ExamBuddie",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "ExamBuddie — Ace WAEC, JAMB & NECO on Telegram",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ExamBuddie — Ace WAEC, JAMB & NECO on Telegram",
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
    "AI-powered exam prep for WAEC, JAMB and NECO — practice past questions directly in Telegram.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "NGN",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "ExamBuddie",
  url: "https://exambuddie.app",
  logo: "https://exambuddie.app/opengraph-image",
  description:
    "AI-powered WAEC, JAMB and NECO exam preparation platform for Nigerian students, accessible directly inside Telegram.",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "support@exambuddie.com",
  },
  areaServed: "NG",
  knowsLanguage: "en-NG",
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

const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={`${geist.variable} scroll-smooth`} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#1D4ED8" />
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
      </head>
      <body className="bg-white text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
