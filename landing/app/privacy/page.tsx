import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — ExamBuddie",
  description: "How ExamBuddie collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
            ← Back to ExamBuddie
          </Link>
        </div>
        <h1 className="mb-2 text-3xl font-bold text-slate-900">Privacy Policy</h1>
        <p className="mb-10 text-sm text-slate-500">Last updated: June 2026</p>

        <div className="space-y-8 text-slate-700 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_p]:leading-relaxed [&_ul]:ml-4 [&_ul]:list-disc [&_ul]:space-y-1">
          <section>
            <h2>1. Who We Are</h2>
            <p>
              ExamBuddie is a Telegram-based exam preparation service for Nigerian students
              preparing for WAEC, JAMB, and NECO. We are operated by ExamBuddie (Nigeria).
              Questions or concerns: <a href="mailto:support@exambuddie.com" className="text-blue-600 hover:underline">support@exambuddie.com</a>.
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
            </ul>
            <p className="mt-3">
              We do <strong>not</strong> collect your phone number, email address, or any
              information beyond what Telegram provides and what you choose while using the bot.
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
            </ul>
            <p className="mt-3">We do not use your data for advertising or sell it to third parties.</p>
          </section>

          <section>
            <h2>4. Data Storage &amp; Security</h2>
            <p>
              Your data is stored in a PostgreSQL database and Redis cache hosted on{" "}
              <a href="https://railway.app" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Railway</a>{" "}
              (US region). We use industry-standard access controls and encrypted connections.
              Payment processing is handled by{" "}
              <a href="https://flutterwave.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Flutterwave</a>{" "}
              — we never store your card details.
            </p>
          </section>

          <section>
            <h2>5. Data Retention</h2>
            <p>
              We keep your account data for as long as you use ExamBuddie. If you request
              deletion, we will remove your personal information within 14 days. Quiz history
              may be retained in anonymised, aggregated form for analytics.
            </p>
          </section>

          <section>
            <h2>6. Third-Party Services</h2>
            <ul>
              <li><strong>Telegram</strong> — powers the chat interface. Subject to Telegram&apos;s own privacy policy.</li>
              <li><strong>Flutterwave</strong> — processes subscription payments.</li>
              <li><strong>Railway</strong> — hosts our database and backend infrastructure.</li>
            </ul>
          </section>

          <section>
            <h2>7. Your Rights</h2>
            <p>You may request to:</p>
            <ul>
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate data</li>
              <li>Delete your account and data</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, message us at{" "}
              <a href="mailto:support@exambuddie.com" className="text-blue-600 hover:underline">support@exambuddie.com</a>{" "}
              or contact us directly via the bot.
            </p>
          </section>

          <section>
            <h2>8. Children</h2>
            <p>
              ExamBuddie is designed for secondary school and university students. We do not
              knowingly collect data from children under 13. If you believe a child has used
              the service, contact us for prompt removal.
            </p>
          </section>

          <section>
            <h2>9. Changes to This Policy</h2>
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
