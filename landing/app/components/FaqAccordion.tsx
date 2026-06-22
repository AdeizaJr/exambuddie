"use client";
import { useState } from "react";
import { faqs } from "../data/faqs";

export function FaqAccordion() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="divide-y divide-slate-200 dark:divide-slate-800">
      {faqs.map(({ q, a }, i) => (
        <div key={q}>
          <button
            onClick={() => setOpenFaq(openFaq === i ? null : i)}
            className="flex w-full items-center justify-between gap-4 py-5 text-left sm:py-6"
          >
            <h3 className="text-sm font-semibold text-slate-900 sm:text-base dark:text-white">{q}</h3>
            <svg
              className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {openFaq === i && (
            <p className="pb-5 text-sm leading-relaxed text-slate-600 sm:pb-6 sm:text-base dark:text-slate-400">
              {a}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
