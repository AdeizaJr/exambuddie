import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use — ExamBuddie",
  description: "Terms and conditions for using ExamBuddie.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Use — ExamBuddie",
    description: "Terms and conditions for using ExamBuddie.",
    type: "website",
    url: "https://exambuddie.app/terms",
  },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white px-4 py-12 sm:px-6 dark:bg-slate-950">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
            ← Back to ExamBuddie
          </Link>
        </div>
        <h1 className="mb-2 text-3xl font-bold text-slate-900 dark:text-white">Terms of Use</h1>
        <p className="mb-10 text-sm text-slate-500 dark:text-slate-400">Last updated: July 2026</p>

        <div className="space-y-8 text-slate-700 dark:text-slate-300 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 dark:[&_h2]:text-white [&_p]:leading-relaxed [&_ul]:ml-4 [&_ul]:list-disc [&_ul]:space-y-1">
          <section>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By using the ExamBuddie Telegram bot or website, you agree to these Terms of Use.
              If you do not agree, please stop using the service immediately. We may update these
              terms at any time; continued use after an update constitutes acceptance.
            </p>
          </section>

          <section>
            <h2>2. Description of Service</h2>
            <p>
              ExamBuddie is an exam preparation tool delivered via Telegram. It provides access
              to past questions for WAEC, JAMB, and NECO, along with timed quizzes, explanations,
              progress tracking, and weak-topic drills. Some features require a paid subscription.
            </p>
          </section>

          <section>
            <h2>3. Eligibility</h2>
            <p>
              You must be at least 13 years old to use ExamBuddie. By using the service, you
              represent that you meet this requirement. Students under 18 should have parental
              or guardian awareness of their subscription.
            </p>
          </section>

          <section>
            <h2>4. Account &amp; Access</h2>
            <ul>
              <li>Your ExamBuddie account is linked to your Telegram account. You are responsible for your Telegram account security.</li>
              <li>Do not share your account or allow others to use your subscription.</li>
              <li>We reserve the right to suspend accounts found to be abusing the service.</li>
            </ul>
          </section>

          <section>
            <h2>5. Subscriptions &amp; Payment</h2>
            <ul>
              <li>Premium plans are available as: monthly (₦1,500/month), a 3-month exam-season bundle (₦3,500), or yearly (₦12,000/year). Current pricing is always shown at the point of purchase inside the bot.</li>
              <li>Payments are processed by Paystack. By subscribing, you agree to Paystack&apos;s payment terms.</li>
              <li>Subscriptions do not auto-renew. You must manually renew when your plan expires.</li>
              <li>Access to premium features ends immediately upon plan expiry.</li>
              <li>See our <Link href="/refunds" className="text-blue-600 hover:underline">Refund Policy</Link> for eligibility details.</li>
            </ul>
          </section>

          <section>
            <h2>6. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Attempt to scrape, copy, or redistribute ExamBuddie questions or content at scale</li>
              <li>Reverse-engineer or exploit the bot&apos;s backend systems</li>
              <li>Use automated tools to interact with the bot in ways not intended for individual students</li>
              <li>Impersonate other users or submit false information</li>
            </ul>
          </section>

          <section>
            <h2>7. Content &amp; Accuracy</h2>
            <p>
              Past questions and answers are sourced from publicly available past examination
              materials. While we strive for accuracy, ExamBuddie does not guarantee that all
              questions or explanations are error-free. If you find an issue, please flag it
              inside the bot so we can review it. ExamBuddie is a study aid — it does not
              guarantee any specific exam result.
            </p>
          </section>

          <section>
            <h2>8. Intellectual Property</h2>
            <p>
              ExamBuddie&apos;s software, design, and original content are owned by ExamBuddie.
              Past examination questions are the property of their respective examination bodies
              (WAEC, JAMB, NECO) and are reproduced here for educational purposes only.
            </p>
          </section>

          <section>
            <h2>9. Limitation of Liability</h2>
            <p>
              ExamBuddie is provided &ldquo;as is.&rdquo; We are not liable for any loss of data,
              missed exam outcomes, or damages arising from use of the service. Our maximum
              liability is limited to the subscription fee you paid in the current billing period.
            </p>
          </section>

          <section>
            <h2>10. Termination</h2>
            <p>
              We may suspend or terminate access to ExamBuddie at any time for violations of
              these terms. You may stop using the service at any time. Refunds upon termination
              are subject to our <Link href="/refunds" className="text-blue-600 hover:underline">Refund Policy</Link>.
            </p>
          </section>

          <section>
            <h2>11. Governing Law</h2>
            <p>
              These terms are governed by the laws of the Federal Republic of Nigeria. Any
              disputes shall be resolved under Nigerian jurisdiction.
            </p>
          </section>

          <section>
            <h2>12. Contact</h2>
            <p>
              For questions about these terms:{" "}
              <a href="mailto:hello@exambuddie.app" className="text-blue-600 hover:underline">hello@exambuddie.app</a>.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-slate-100 pt-8 text-xs text-slate-400">
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
            <Link href="/refunds" className="hover:underline">Refund Policy</Link>
            <Link href="/" className="hover:underline">Back to Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
