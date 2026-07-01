import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — ExamBuddie",
  description: "How ExamBuddie collects, uses, and protects your data.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy — ExamBuddie",
    description: "How ExamBuddie collects, uses, and protects your data.",
    type: "website",
    url: "https://exambuddie.app/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white px-4 py-12 sm:px-6 dark:bg-slate-950">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
            ← Back to ExamBuddie
          </Link>
        </div>
        <h1 className="mb-2 text-3xl font-bold text-slate-900 dark:text-white">Privacy Policy</h1>
        <p className="mb-10 text-sm text-slate-500 dark:text-slate-400">Last updated: July 2026</p>

        <div className="space-y-8 text-slate-700 dark:text-slate-300 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 dark:[&_h2]:text-white [&_p]:leading-relaxed [&_ul]:ml-4 [&_ul]:list-disc [&_ul]:space-y-1">
          <section>
            <h2>1. Who We Are</h2>
            <p>
              ExamBuddie is a Telegram-based exam preparation service for Nigerian students
              preparing for WAEC, JAMB, and NECO. We are operated by ExamBuddie (Nigeria).
            </p>
            <p className="mt-2">
              <strong>Data Controller &amp; Responsible Person:</strong> Hassan Adeiza, ExamBuddie — Oyo, Nigeria.<br />
              <strong>Contact:</strong> <a href="mailto:support@exambuddie.app" className="text-blue-600 hover:underline">support@exambuddie.app</a>
            </p>
          </section>

          <section>
            <h2>2. Data We Collect</h2>
            <p>When you use the ExamBuddie Telegram bot, we collect:</p>
            <ul>
              <li>Your Telegram user ID, first name, last name, and username (provided by Telegram)</li>
              <li>Your exam preferences — exam type (WAEC/JAMB/NECO), target year, and selected subjects</li>
              <li>Your quiz and practice history — questions answered, scores, time taken</li>
              <li>Your subscription status and payment reference numbers</li>
              <li>Your daily streak and progress statistics</li>
              <li>
                Your phone number — <strong>optional</strong>, only if you choose to share it via
                the bot. We use this to contact you about your subscription, account changes, or
                important service updates. You can skip this at any time and add or remove it
                later via Settings.
              </li>
            </ul>
            <p className="mt-3">
              We do <strong>not</strong> collect your email address or any information beyond
              what is listed above.
            </p>
          </section>

          <section>
            <h2>3. How We Use Your Data</h2>
            <ul>
              <li>To personalise your question feed based on your chosen subjects and exam type</li>
              <li>To track your progress and display your stats</li>
              <li>To enforce daily question limits for free accounts</li>
              <li>To activate and verify premium subscriptions</li>
              <li>To detect weak topics and surface targeted drills</li>
              <li>Your progress is stored to track your performance and help you improve over time</li>
              <li>To send scheduled study reminders (if enabled)</li>
              <li>To contact you about your subscription or account via phone, if you provided your number</li>
            </ul>
            <p className="mt-3">We do not use your data for advertising or sell it to third parties.</p>
            <p className="mt-3">
              <strong>Legal basis (Nigeria Data Protection Act 2023):</strong> We process your
              data on the basis of <em>contractual necessity</em> — to deliver the exam prep
              service you signed up for. Where we send optional reminders or use your phone
              number to contact you, we rely on your <em>consent</em>, which you can withdraw
              at any time via Settings. Aggregate analytics are processed under <em>legitimate
              interest</em> to improve the service.
            </p>
          </section>

          <section>
            <h2>4. Data Storage &amp; Security</h2>
            <p>
              Your data is stored in a PostgreSQL database and Redis cache hosted on{" "}
              <a href="https://railway.app" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Railway</a>{" "}
              (US region). We use industry-standard access controls and encrypted connections (TLS in transit, AES-256 at rest).
              Payment processing is handled by{" "}
              <a href="https://flutterwave.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Flutterwave</a>{" "}
              — we never store your card details.
            </p>
            <p className="mt-2">
              <strong>Cross-border transfers:</strong> Your data is transferred from Nigeria to the United States (Railway infrastructure).
              This transfer is covered by contractual data processing agreements with Railway, which provide equivalent protections to those required under the Nigeria Data Protection Act 2023.
              By using ExamBuddie, you acknowledge this transfer.
            </p>
          </section>

          <section>
            <h2>5. Data Retention</h2>
            <ul>
              <li>Active accounts: we keep your data for as long as you use ExamBuddie.</li>
              <li>Inactive accounts: if you don&apos;t use the bot for 24 consecutive months, we delete your personal identifiers (Telegram ID, name, username) automatically.</li>
              <li>Deletion requests: we remove your personal information within 14 days of your request.</li>
              <li>Payment records: subscription/payment references are kept for 7 years to meet Nigerian financial record-keeping requirements.</li>
              <li>Quiz and practice history may be retained in anonymised, aggregated form indefinitely for analytics — this data cannot be linked back to you once anonymised.</li>
            </ul>
          </section>

          <section>
            <h2>6. Data Breach Response</h2>
            <p>If we discover a security incident affecting your personal data, we will:</p>
            <ul>
              <li>Investigate and contain the incident as soon as it is identified</li>
              <li>Assess what data and how many users were affected</li>
              <li>Notify affected users via the bot within 72 hours of confirming a breach, explaining what happened and what we&apos;re doing about it</li>
              <li>Notify the Nigeria Data Protection Commission (NDPC) where required under the Nigeria Data Protection Act 2023</li>
              <li>Take corrective action to prevent recurrence (e.g. patching the vulnerability, rotating credentials)</li>
            </ul>
            <p className="mt-3">
              To report a suspected security issue, email{" "}
              <a href="mailto:support@exambuddie.app" className="text-blue-600 hover:underline">support@exambuddie.app</a>.
            </p>
          </section>

          <section>
            <h2>7. Third-Party Services &amp; Data Processors</h2>
            <p>We share data with the following processors only to the extent necessary to deliver the service:</p>
            <ul>
              <li><strong>Telegram</strong> — powers the chat interface. Your Telegram profile data (user ID, name, username) is provided by Telegram when you use the bot. Subject to <a href="https://telegram.org/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Telegram&apos;s Privacy Policy</a>.</li>
              <li><strong>Flutterwave</strong> — processes subscription payments. We share only a payment reference; we never store or transmit your card details.</li>
              <li><strong>Railway</strong> — hosts our database and backend infrastructure in the US. Data is transferred from Nigeria to the US under contractual safeguards.</li>
              <li><strong>Anthropic</strong> — when an admin generates an AI explanation for a question, the question text and answer options (no personal data) are sent to Anthropic&apos;s API. No user identifiers are included in these requests. Subject to <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Anthropic&apos;s Privacy Policy</a>.</li>
              <li><strong>Zoho Mail</strong> — used to send support email responses. Only your name and Telegram ID are included when you submit a support request.</li>
            </ul>
            <p className="mt-3">We do not sell your data to any third party and do not use your data for advertising.</p>
          </section>

          <section>
            <h2>8. Your Rights</h2>
            <p>Under the Nigeria Data Protection Act 2023, you have the right to:</p>
            <ul>
              <li><strong>Access</strong> — request a copy of the personal data we hold about you</li>
              <li><strong>Correction</strong> — ask us to fix inaccurate or incomplete data</li>
              <li><strong>Deletion</strong> — request erasure of your account and personal data</li>
              <li><strong>Portability</strong> — receive your data in a structured, machine-readable format</li>
              <li><strong>Object</strong> — object to processing based on legitimate interest</li>
              <li><strong>Withdraw consent</strong> — turn off notifications or remove your phone number at any time via Settings in the bot, without affecting your ability to use the service</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email us at{" "}
              <a href="mailto:support@exambuddie.app" className="text-blue-600 hover:underline">support@exambuddie.app</a>{" "}
              or use the <strong>/support</strong> command in the ExamBuddie Telegram bot and select <em>Data Request</em>. We will respond within 30 days.
            </p>
            <p className="mt-3">
              If you are unhappy with how we handle your data, you have the right to lodge a
              complaint with the{" "}
              <a href="https://ndpc.gov.ng" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                Nigeria Data Protection Commission (NDPC)
              </a>.
            </p>
          </section>

          <section>
            <h2>9. Children and Young Users</h2>
            <p>
              ExamBuddie is designed for secondary school and university students. Our users
              commonly include students aged 15–17 preparing for WAEC and JAMB. We recognise
              that many users are under 18 and apply heightened care to their data as required
              by the Nigeria Data Protection Act 2023:
            </p>
            <ul>
              <li>We collect only the minimum data needed to deliver the service</li>
              <li>We do not share personal data of under-18 users with any third party for commercial purposes</li>
              <li>Parental or guardian consent is required for users under 13. If you believe a child under 13 has used the service without parental consent, contact us and we will delete the account promptly</li>
            </ul>
          </section>

          <section>
            <h2>10. Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. Material changes will be announced
              via the bot. Continued use of ExamBuddie after changes constitutes acceptance.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-slate-100 pt-8 text-xs text-slate-400">
          <div className="flex flex-wrap gap-4">
            <Link href="/terms" className="hover:underline">Terms of Use</Link>
            <Link href="/refunds" className="hover:underline">Refund Policy</Link>
            <Link href="/" className="hover:underline">Back to Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
