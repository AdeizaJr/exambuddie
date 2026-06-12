import Link from "next/link";

const BOT_URL = "https://t.me/ExamBuddieBot";

const subjects = [
  { icon: "📐", name: "Mathematics" },
  { icon: "🔬", name: "Biology" },
  { icon: "⚗️", name: "Chemistry" },
  { icon: "⚡", name: "Physics" },
  { icon: "📖", name: "English Language" },
  { icon: "🌍", name: "Geography" },
  { icon: "📜", name: "History" },
  { icon: "💰", name: "Economics" },
  { icon: "📊", name: "Accounts" },
  { icon: "✝️", name: "CRK / IRK" },
  { icon: "🌱", name: "Agric Science" },
  { icon: "🏛️", name: "Government" },
];

const features = [
  {
    icon: "📚",
    title: "Practice Mode",
    description:
      "Go through past questions at your own pace with instant explanations after every answer.",
  },
  {
    icon: "📋",
    title: "Timed Quiz",
    description:
      "Simulate real exam conditions with a countdown timer. 40 questions, exam-style pressure.",
  },
  {
    icon: "🎯",
    title: "Drill Mode",
    description:
      "Zero in on your weakest topics. ExamBuddie identifies the gaps and drills you on them.",
  },
  {
    icon: "📊",
    title: "Progress Stats",
    description:
      "Track accuracy by subject and topic. Know exactly where you stand before exam day.",
  },
  {
    icon: "🏆",
    title: "Multi-Subject Sessions",
    description:
      "Mix subjects in a single practice or quiz session — just like the real exam.",
  },
  {
    icon: "⚡",
    title: "Works in Telegram",
    description:
      "No app download. No account. Open Telegram, start a chat, and you're practising in seconds.",
  },
];

const plans = [
  {
    name: "Free",
    price: "₦0",
    period: "forever",
    description: "Start practising today at no cost.",
    features: [
      "5 questions per subject every 6 hours",
      "All WAEC, JAMB & NECO subjects",
      "Instant answer explanations",
      "Basic stats tracking",
    ],
    cta: "Start Free",
    href: BOT_URL,
    highlight: false,
  },
  {
    name: "Premium",
    price: "₦800",
    period: "per month",
    description: "Everything you need to top the exam.",
    features: [
      "Unlimited questions — no daily caps",
      "Multi-subject quiz & practice",
      "Full drill mode on weak topics",
      "Detailed progress analytics",
      "Priority support",
    ],
    cta: "Go Premium",
    href: BOT_URL,
    highlight: true,
  },
];

const faqs = [
  {
    q: "Do I need to download anything?",
    a: "No. ExamBuddie runs entirely inside Telegram. If you have Telegram installed, you're ready to go.",
  },
  {
    q: "Which exams does ExamBuddie cover?",
    a: "WAEC, JAMB and NECO. Questions span all major subjects including Maths, English, Sciences, Humanities and more.",
  },
  {
    q: "How many questions are in the database?",
    a: "Over 41,000 past questions with explanations, sourced from real WAEC, JAMB and NECO papers.",
  },
  {
    q: "Can I use ExamBuddie on mobile?",
    a: "Yes — Telegram works on Android, iOS, and desktop. ExamBuddie works on all of them.",
  },
  {
    q: "What happens when I hit the free limit?",
    a: "Your 5-question window resets every 6 hours, giving you up to 20 questions per subject per day on the free plan.",
  },
  {
    q: "How do I upgrade to Premium?",
    a: "Send /subscribe inside the bot and follow the prompts. Upgrades are instant.",
  },
];

export default function Home() {
  return (
    <div className="font-[var(--font-geist)]">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-blue-600">ExamBuddie</span>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#subjects" className="hover:text-slate-900 transition-colors">Subjects</a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-slate-900 transition-colors">FAQ</a>
          </div>
          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-full hover:bg-blue-700 transition-colors"
          >
            Open in Telegram
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 text-center bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            🎓 WAEC, JAMB &amp; NECO Prep — Nigeria
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 leading-tight tracking-tight mb-6">
            Pass your exam.<br />
            <span className="text-blue-600">Study on Telegram.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 leading-relaxed mb-10 max-w-2xl mx-auto">
            Over 41,000 past WAEC, JAMB and NECO questions. Timed quizzes, instant
            explanations, and progress tracking — all inside Telegram. No app to download.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={BOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-blue-600 text-white font-bold text-lg px-8 py-4 rounded-full hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
            >
              Start Practising Free →
            </a>
            <a
              href="#features"
              className="text-slate-700 font-semibold text-lg px-8 py-4 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
            >
              See how it works
            </a>
          </div>
          <p className="mt-6 text-sm text-slate-400">Free to start · No download required · Works on any device</p>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-blue-600 py-10">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
          {[
            { value: "41,000+", label: "Past Questions" },
            { value: "12+", label: "Subjects" },
            { value: "WAEC, JAMB & NECO", label: "Exams Covered" },
            { value: "Free", label: "To Start" },
          ].map(({ value, label }) => (
            <div key={label}>
              <div className="text-3xl font-extrabold">{value}</div>
              <div className="text-blue-200 text-sm mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold text-slate-900 mb-4">Everything you need to prepare</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              Built for Nigerian students. Designed to be fast, focused, and effective.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map(({ icon, title, description }) => (
              <div
                key={title}
                className="bg-slate-50 rounded-2xl p-8 hover:shadow-md transition-shadow"
              >
                <div className="text-4xl mb-4">{icon}</div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-500 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-extrabold text-slate-900 mb-4">Up and running in 30 seconds</h2>
          <p className="text-slate-500 text-lg mb-16">No sign-up forms. No app stores. Just Telegram.</p>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              { step: "1", title: "Open Telegram", desc: "Search for @ExamBuddieBot or tap the button below." },
              { step: "2", title: "Pick your subjects", desc: "Choose WAEC, JAMB or NECO and up to 5 subjects you're studying." },
              { step: "3", title: "Start practising", desc: "Practice, quiz, or drill — your progress saves automatically." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-blue-600 text-white text-2xl font-extrabold flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
                  {step}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-12 inline-block bg-blue-600 text-white font-bold text-lg px-8 py-4 rounded-full hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
          >
            Open ExamBuddie →
          </a>
        </div>
      </section>

      {/* Subjects */}
      <section id="subjects" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold text-slate-900 mb-4">All major subjects covered</h2>
            <p className="text-slate-500 text-lg">WAEC, JAMB and NECO past questions across every core subject.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {subjects.map(({ icon, name }) => (
              <div
                key={name}
                className="flex flex-col items-center gap-2 bg-slate-50 rounded-xl p-4 text-center hover:bg-blue-50 transition-colors"
              >
                <span className="text-3xl">{icon}</span>
                <span className="text-sm font-medium text-slate-700">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold text-slate-900 mb-4">Simple pricing</h2>
            <p className="text-slate-500 text-lg">Start free. Upgrade when you need more.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {plans.map(({ name, price, period, description, features: planFeatures, cta, href, highlight }) => (
              <div
                key={name}
                className={`rounded-2xl p-8 flex flex-col ${
                  highlight
                    ? "bg-blue-600 text-white shadow-2xl shadow-blue-200 ring-2 ring-blue-600"
                    : "bg-white border border-slate-200"
                }`}
              >
                <div className="mb-6">
                  <div className={`text-sm font-semibold uppercase tracking-wide mb-1 ${highlight ? "text-blue-200" : "text-blue-600"}`}>
                    {name}
                  </div>
                  <div className="flex items-end gap-1 mb-2">
                    <span className={`text-4xl font-extrabold ${highlight ? "text-white" : "text-slate-900"}`}>{price}</span>
                    <span className={`text-sm mb-1.5 ${highlight ? "text-blue-200" : "text-slate-400"}`}>/{period}</span>
                  </div>
                  <p className={`text-sm ${highlight ? "text-blue-100" : "text-slate-500"}`}>{description}</p>
                </div>
                <ul className="flex-1 space-y-3 mb-8">
                  {planFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm">
                      <span className={highlight ? "text-blue-200" : "text-blue-600"}>✓</span>
                      <span className={highlight ? "text-blue-50" : "text-slate-600"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full text-center font-bold py-3 rounded-full transition-colors ${
                    highlight
                      ? "bg-white text-blue-600 hover:bg-blue-50"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold text-slate-900 mb-4">Frequently asked questions</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {faqs.map(({ q, a }) => (
              <div key={q} className="py-6">
                <h3 className="text-base font-semibold text-slate-900 mb-2">{q}</h3>
                <p className="text-slate-500 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-24 px-6 bg-blue-600 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-extrabold mb-4">Ready to ace your exam?</h2>
          <p className="text-blue-100 text-lg mb-10">
            Join thousands of Nigerian students already practising on ExamBuddie.
          </p>
          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-white text-blue-600 font-bold text-lg px-10 py-4 rounded-full hover:bg-blue-50 transition-colors shadow-xl"
          >
            Start Practising Free →
          </a>
          <p className="mt-4 text-blue-200 text-sm">No download. No sign-up. Open Telegram and go.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-slate-100">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <span className="font-bold text-slate-700">ExamBuddie</span>
          <span>© {new Date().getFullYear()} ExamBuddie. Built for Nigerian students.</span>
          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 font-medium hover:underline"
          >
            Open in Telegram →
          </a>
        </div>
      </footer>
    </div>
  );
}
