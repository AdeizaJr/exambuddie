import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy — ExamBuddie",
  description: "ExamBuddie's subscription refund and cancellation policy.",
};

export default function RefundsPage() {
  return (
    <div className="min-h-screen bg-white px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
            ← Back to ExamBuddie
          </Link>
        </div>
        <h1 className="mb-2 text-3xl font-bold text-slate-900">Refund Policy</h1>
        <p className="mb-10 text-sm text-slate-500">Last updated: June 2026</p>

        <div className="space-y-8 text-slate-700 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_p]:leading-relaxed [&_ul]:ml-4 [&_ul]:list-disc [&_ul]:space-y-1">
          <section>
            <h2>Our Default Position</h2>
            <p>
              All ExamBuddie subscription payments are <strong>non-refundable</strong> once
              premium access has been activated. Because ExamBuddie delivers digital content
              instantly, we are unable to reverse access once it has been granted.
            </p>
            <p className="mt-3">
              We encourage you to use the free tier to evaluate the service before subscribing.
            </p>
          </section>

          <section>
            <h2>Eligible Refund Cases</h2>
            <p>We will issue a full refund if <em>all</em> of the following are true:</p>
            <ul>
              <li>The ExamBuddie service was unavailable or non-functional for more than 48 consecutive hours during your active subscription period</li>
              <li>The outage was caused by ExamBuddie&apos;s infrastructure (not Telegram&apos;s own outage or your internet connection)</li>
              <li>You contacted us within 7 days of the outage to report the issue</li>
            </ul>
          </section>

          <section>
            <h2>Duplicate Payments</h2>
            <p>
              If you were charged twice for the same subscription period due to a payment
              processing error, we will refund the duplicate charge in full once we verify
              the transaction. Contact us with both payment reference numbers.
            </p>
          </section>

          <section>
            <h2>Cancellation</h2>
            <p>
              ExamBuddie subscriptions do not auto-renew. Your premium access remains active
              until the end of your paid period. You do not need to &ldquo;cancel&rdquo; — simply
              do not renew when prompted. No partial refunds are given for unused days.
            </p>
          </section>

          <section>
            <h2>How to Request a Refund</h2>
            <p>Send an email to{" "}
              <a href="mailto:support@exambuddie.com" className="text-blue-600 hover:underline">support@exambuddie.com</a>{" "}
              with:
            </p>
            <ul>
              <li>Your Telegram username or user ID</li>
              <li>Your Flutterwave payment reference (found in the bot after payment)</li>
              <li>A brief description of the issue</li>
            </ul>
            <p className="mt-3">
              We aim to respond to all refund requests within 3 business days. Approved
              refunds are processed back to your original payment method within 5–10 business days.
            </p>
          </section>

          <section>
            <h2>Changes to This Policy</h2>
            <p>
              We reserve the right to update this policy. Changes take effect for new
              subscriptions purchased after the update date.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-slate-100 pt-8 text-xs text-slate-400">
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
            <Link href="/terms" className="hover:underline">Terms of Use</Link>
            <Link href="/" className="hover:underline">Back to Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
