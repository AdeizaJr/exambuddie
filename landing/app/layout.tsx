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
    <html lang="en" className={`${geist.variable} scroll-smooth`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }}
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
