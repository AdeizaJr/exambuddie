import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "ExamBuddie — Ace WAEC, JAMB & NECO on Telegram",
  description:
    "Practice WAEC, JAMB and NECO past questions directly in Telegram. Timed quizzes, instant explanations, and progress tracking — free to start.",
  openGraph: {
    title: "ExamBuddie — Ace WAEC, JAMB & NECO on Telegram",
    description:
      "Practice WAEC, JAMB and NECO past questions directly in Telegram. Timed quizzes, instant explanations, and progress tracking.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} scroll-smooth`}>
      <body className="antialiased bg-white text-slate-900">{children}</body>
    </html>
  );
}
