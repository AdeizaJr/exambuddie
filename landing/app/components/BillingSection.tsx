"use client";
import { useState } from "react";
import type { PricingData } from "../lib/pricing";

const BOT_URL = "https://t.me/ExamBuddieBot";

function naira(amount: number): string {
  return `₦${amount.toLocaleString()}`;
}

export function BillingSection({ pricing }: { pricing: PricingData }) {
  const [billingYearly, setBillingYearly] = useState(false);

  const { monthly_ngn, term_ngn, yearly_ngn } = pricing;
  const termSavings = monthly_ngn * 3 - term_ngn;
  const yearlySavings = monthly_ngn * 12 - yearly_ngn;
  const yearlySavingsPct = Math.round((yearlySavings / (monthly_ngn * 12)) * 100);

  const plans = [
    {
      name: "Free",
      price: "Free",
      period: "",
      description: "Start practising today: 14 days Premium free, no card needed.",
      features: [
        "14-day Premium trial on signup",
        "5 questions per subject every 6 hours",
        "All WAEC, JAMB & NECO subjects",
        "Instant answer explanations",
        "Progress tracking & exam countdown",
      ],
      cta: "Start Free",
      href: `${BOT_URL}?start=from_pricing`,
      highlight: false,
      badge: null,
    },
    {
      name: "Term",
      price: naira(term_ngn),
      period: "3 months",
      description: `Exam-season bundle. Save ${naira(termSavings)} vs monthly.`,
      features: [
        "Everything in Premium",
        "Perfect for WAEC / JAMB prep window",
        `Save ${naira(termSavings)} vs 3× monthly`,
      ],
      cta: "Get Term Plan",
      href: `${BOT_URL}?start=subscribe_term`,
      highlight: false,
      badge: `Save ${naira(termSavings)}`,
    },
    {
      name: "Premium",
      price: billingYearly ? naira(yearly_ngn) : naira(monthly_ngn),
      period: billingYearly ? "year" : "month",
      description: billingYearly
        ? `Save ${naira(yearlySavings)} vs monthly: best value.`
        : "Everything you need to top the exam.",
      features: [
        "Unlimited questions: no daily caps",
        "Multi-subject quiz & practice",
        "Full drill mode on weak topics",
        "Spaced repetition: wrong answers come back",
        "Streak freeze: protect your streak once/week",
        "Challenge Mode: create rooms & compete",
        "Detailed progress analytics & exam countdown",
        "Weekly performance reports",
        "Referral rewards (/invite)",
        "Priority support",
      ],
      cta: "Go Premium",
      href: billingYearly ? `${BOT_URL}?start=subscribe_yearly` : `${BOT_URL}?start=subscribe_monthly`,
      highlight: true,
      badge: billingYearly ? `Save ${yearlySavingsPct}%` : null,
    },
  ];

  return (
    <>
      <div className="mb-10 text-center sm:mb-16">
        <h2 className="mb-3 text-2xl font-bold text-slate-900 sm:mb-4 sm:text-3xl md:text-4xl dark:text-white">
          Simple pricing
        </h2>
        <p className="mb-6 text-base text-slate-600 sm:text-lg dark:text-slate-400">
          Start free. Upgrade when you need more.
        </p>
        <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
          <button
            onClick={() => setBillingYearly(false)}
            aria-pressed={!billingYearly}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              !billingYearly
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white"
                : "text-slate-600 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingYearly(true)}
            aria-pressed={billingYearly}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              billingYearly
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white"
                : "text-slate-600 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            }`}
          >
            Yearly
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-900 dark:text-green-300">
              Save {yearlySavingsPct}%
            </span>
          </button>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-3 sm:gap-6">
        {plans.map(({ name, price, period, description, features: planFeatures, cta, href, highlight, badge }) => (
          <div
            key={name}
            className={`relative flex flex-col rounded-2xl p-6 sm:p-8 ${
              highlight
                ? "bg-blue-700 text-white shadow-2xl ring-2 shadow-blue-200 ring-blue-700 dark:bg-blue-900 dark:shadow-none dark:ring-blue-800"
                : "border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            }`}
          >
            {badge && (
              <span className="absolute -top-3 right-6 rounded-full bg-green-500 px-3 py-1 text-xs font-bold text-white shadow">
                {badge}
              </span>
            )}
            <div className="mb-5 sm:mb-6">
              <div className={`mb-1 text-xs font-semibold tracking-wide uppercase sm:text-sm ${highlight ? "text-blue-200" : "text-blue-700 dark:text-blue-400"}`}>
                {name}
              </div>
              <div className="mb-1 flex items-end gap-1">
                <span className={`text-3xl font-bold sm:text-4xl ${highlight ? "text-white" : "text-slate-900 dark:text-white"}`}>
                  {price}
                </span>
                {period && (
                  <span className={`mb-1.5 text-xs sm:text-sm ${highlight ? "text-blue-200" : "text-slate-500 dark:text-slate-400"}`}>
                    /{period}
                  </span>
                )}
              </div>
              {highlight && (
                <p className="mb-2 text-[11px] font-medium text-blue-200">
                  {billingYearly
                    ? `${naira(Math.round(yearly_ngn / 12))}/month: save ${naira(yearlySavings)} vs monthly`
                    : `That's less than ${naira(Math.round(monthly_ngn / 30))} a day`}
                </p>
              )}
              <p className={`text-xs sm:text-sm ${highlight ? "text-blue-100" : "text-slate-600 dark:text-slate-400"}`}>
                {description}
              </p>
            </div>
            <ul className="mb-6 flex-1 space-y-3 sm:mb-8">
              {planFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3 text-xs sm:text-sm">
                  <span className={highlight ? "text-green-300" : "text-green-600 dark:text-green-400"}>✓</span>
                  <span className={highlight ? "text-blue-50" : "text-slate-600 dark:text-slate-400"}>{f}</span>
                </li>
              ))}
            </ul>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full rounded-full py-3 text-center text-sm font-bold transition-colors sm:text-base ${
                highlight
                  ? "bg-white text-blue-700 hover:bg-blue-50"
                  : "bg-blue-700 text-white hover:bg-blue-800"
              }`}
            >
              {cta}
            </a>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-500">
        Premium auto-renews each cycle if your card supports it: cancel anytime from the bot.
      </p>
    </>
  );
}
