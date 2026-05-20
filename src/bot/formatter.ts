// src/bot/formatter.ts — All message templates
import { Question, User } from '../types';

export const SUBJECT_MAP: Record<string, string> = {
  english:    '📝 English Language',
  math:       '🔢 Mathematics',
  biology:    '🧬 Biology',
  chemistry:  '⚗️ Chemistry',
  physics:    '⚡ Physics',
  economics:  '📊 Economics',
  government: '🏛️ Government',
  literature: '📚 Literature',
  geography:  '🌍 Geography',
};

export const SUBJECT_EMOJI: Record<string, string> = {
  english: '📝',
  math: '🔢',
  biology: '🧬',
  chemistry: '⚗️',
  physics: '⚡',
  economics: '📊',
  government: '🏛️',
  literature: '📚',
  geography: '🌍',
};

export function welcome(firstName: string): string {
  return `🎓 *Welcome to ExamAce, ${firstName}!*

I'm your personal WAEC & JAMB exam prep assistant. I'll give you past questions, explain every answer, and track your progress.

Let's set up your profile in 3 quick steps so I can tailor questions to your exam.

👇 First, which exam are you preparing for?`;
}

export function askSubjects(examType: string): string {
  return `✅ *${examType} selected!*

Now choose your subjects. You can pick multiple — I'll prepare questions for each one.

Reply with the numbers separated by commas (e.g. *1, 2, 5*) or tap individual options:`;
}

export function profileComplete(user: User): string {
  const subjects = user.subjects.map(s => SUBJECT_MAP[s] || s).join(', ');
  return `🎉 *Profile set up! You're ready.*

📋 *Your Profile:*
• Exam: *${user.exam_type}*
• Subjects: ${subjects}

*What would you like to do?*
• /practice — Start practising now
• /quiz — Take a timed mock exam
• /stats — See your progress
• /subscribe — Get unlimited access
• /help — All commands`;
}

export function formatQuestion(q: Question, number: number, total: number | string, mode?: string): string {
  const modeTag = mode === 'quiz'
    ? `📋 *Question ${number}/${total}*`
    : mode === 'drill'
    ? `🎯 *Topic Drill: ${q.topic || 'Mixed'}*`
    : `📚 *Practice Mode*`;

  return `${modeTag}
_${q.exam_type} ${q.subject.charAt(0).toUpperCase() + q.subject.slice(1)} ${q.year}_

${q.question_text}`;
}

export function answerKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🅰️  A', callback_data: 'answer:A' },
        { text: '🅱️  B', callback_data: 'answer:B' },
      ],
      [
        { text: '🅲  C', callback_data: 'answer:C' },
        { text: '🅳  D', callback_data: 'answer:D' },
      ],
    ],
  };
}

export function answerOptions(q: Question): string {
  return `\n\n*A.* ${q.option_a}\n*B.* ${q.option_b}\n*C.* ${q.option_c}\n*D.* ${q.option_d}`;
}

export function correctAnswer(q: Question, selected: string): string {
  const wasCorrect = selected === q.correct_option;
  const emoji = wasCorrect ? '✅' : '❌';
  const header = wasCorrect
    ? `${emoji} *Correct! Well done.*`
    : `${emoji} *Not quite. The answer is ${q.correct_option}.*`;

  const optionText: Record<string, string> = {
    A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d,
  };

  return `${header}

✔️ *${q.correct_option}.* ${optionText[q.correct_option]}

💡 *Explanation:*
${q.explanation || '_Explanation coming soon._'}`;
}

export function afterAnswerKeyboard(mode?: string) {
  if (mode === 'quiz') {
    return {
      inline_keyboard: [[
        { text: '➡️  Next Question', callback_data: 'quiz:next' },
        { text: '🚩 Flag', callback_data: 'flag:question' },
      ]],
    };
  }
  return {
    inline_keyboard: [[
      { text: '➡️  Next Question', callback_data: 'practice:next' },
      { text: '🚩 Flag Explanation', callback_data: 'flag:question' },
      { text: '⏹  Stop', callback_data: 'practice:stop' },
    ]],
  };
}

export function sessionSummary({
  correct,
  total,
  subject,
  mode,
  durationSecs,
}: {
  correct: number;
  total: number;
  subject: string;
  mode: string;
  durationSecs?: number;
}): string {
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const grade = accuracy >= 70 ? '🌟 Excellent!' : accuracy >= 50 ? '👍 Good effort!' : '💪 Keep practising!';
  const minutes = durationSecs ? Math.round(durationSecs / 60) : null;

  return `📊 *Session Summary*

${grade}

📌 Mode: ${mode.charAt(0).toUpperCase() + mode.slice(1)}
📚 Subject: ${SUBJECT_MAP[subject] || subject}
✅ Correct: ${correct}/${total}
🎯 Accuracy: ${accuracy}%${minutes ? `\n⏱️ Time: ${minutes} min` : ''}

${accuracy < 50 ? '💡 _Tip: Try /drill to focus on specific weak topics._' : ''}
${accuracy >= 70 ? '🔥 Keep it up! Consistency is key.' : ''}

What next?`;
}

export function sessionKeyboard(subject: string) {
  return {
    inline_keyboard: [
      [
        { text: '🔄 Practice Again', callback_data: `practice:start:${subject}` },
        { text: '🎯 Drill Weak Topics', callback_data: `drill:auto:${subject}` },
      ],
      [
        { text: '📊 My Stats', callback_data: 'stats:show' },
        { text: '🏠 Main Menu', callback_data: 'menu:main' },
      ],
    ],
  };
}

export function statsMessage(user: User, stats: any, weakTopics?: any[]): string {
  const plan = user.plan === 'premium'
    ? `⭐ Premium (expires ${user.plan_expires_at ? new Date(user.plan_expires_at).toLocaleDateString('en-NG') : 'N/A'})`
    : '🆓 Free (5 questions/day)';

  const weakSection = weakTopics && weakTopics.length > 0
    ? '\n⚠️ *Weak Topics (focus here!):*\n' +
      weakTopics.map(t => `  • ${t.topic}: ${t.accuracy}% accuracy (${t.attempts} attempts)`).join('\n')
    : '';

  return `📈 *Your ExamAce Stats*

👤 ${user.first_name}
📋 Exam: ${user.exam_type || 'Not set'}
🗓️ Joined: ${new Date(user.joined_at).toLocaleDateString('en-NG')}

📊 *Overall Performance:*
• Total Attempts: ${stats.total_attempts || 0}
• Correct Answers: ${stats.correct || 0}
• Accuracy: ${stats.accuracy || 0}%
• 🔥 Streak: ${user.streak || 0} days

💳 *Plan:* ${plan}
${weakSection}`;
}

export function freeLimitMessage(remaining: number, limit: number): string | null {
  if (remaining === 0) {
    return `⏰ *Daily limit reached!*

You've used all ${limit} free questions for today. Come back tomorrow, or upgrade to Premium for *unlimited access*.

💎 *ExamAce Premium:*
• Unlimited questions, every day
• Quiz mode & Topic drills
• Progress tracking & weak-topic detection
• Only ₦800/month or ₦7,000/year

👇 Tap to upgrade:`;
  }
  return null; // no message needed
}

export function upgradeMessage(): string {
  return `💎 *Upgrade to ExamAce Premium*

Unlock everything you need to ace your exams:

✅ Unlimited questions (no daily cap)
✅ Timed quiz mode (40 questions, 45 mins)
✅ Topic drill (target weak areas)
✅ Progress tracking & stats
✅ Weak topic detection
✅ Priority support

💰 *Pricing:*
• Monthly: ₦800/month
• Yearly: ₦7,000/year *(save ₦2,600)*

Choose your plan:`;
}

export function subscribeKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '📅 Monthly — ₦800', callback_data: 'subscribe:monthly' }],
      [{ text: '🗓️ Yearly — ₦7,000 (Best Value)', callback_data: 'subscribe:yearly' }],
      [{ text: '❌ Maybe Later', callback_data: 'menu:main' }],
    ],
  };
}

export function paymentLinkMessage(link: string, planLabel: string, txRef: string): string {
  return `🔗 *Your Secure Payment Link*

Plan: ${planLabel}

👉 [Click here to pay securely](${link})

_Payment powered by Flutterwave. Your access will be activated instantly after payment._

Reference: \`${txRef}\``;
}

export function helpMessage(): string {
  return `📖 *ExamAce Commands*

*Practice:*
/practice — Start a practice session
/quiz — Take a 40-question timed mock exam
/drill [topic] — Drill a specific topic

*Account:*
/settings — Update your profile
/stats — View your progress
/subscribe — Upgrade to Premium

*Other:*
/stop — Stop current session
/help — Show this menu

💡 *Tip:* During practice, tap ➡️ for the next question or 🚩 to flag a wrong explanation.

Questions? DM @ExamAceSupport`;
}

export function examTypeKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '📘 WAEC', callback_data: 'onboard:exam:WAEC' }],
      [{ text: '📗 JAMB (UTME)', callback_data: 'onboard:exam:JAMB' }],
      [{ text: '📙 Both', callback_data: 'onboard:exam:BOTH' }],
    ],
  };
}

export function subjectKeyboard(selectedSubjects: string[] = []) {
  const subjects = [
    { code: 'english', label: '📝 English' },
    { code: 'math', label: '🔢 Maths' },
    { code: 'biology', label: '🧬 Biology' },
    { code: 'chemistry', label: '⚗️ Chemistry' },
    { code: 'physics', label: '⚡ Physics' },
    { code: 'economics', label: '📊 Economics' },
    { code: 'government', label: '🏛️ Government' },
    { code: 'literature', label: '📚 Literature' },
    { code: 'geography', label: '🌍 Geography' },
  ];

  const buttons = subjects.map(s => ({
    text: selectedSubjects.includes(s.code) ? `✅ ${s.label}` : s.label,
    callback_data: `onboard:subject:${s.code}`,
  }));

  // 2 per row
  const rows: any[][] = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }
  if (selectedSubjects.length > 0) {
    rows.push([{ text: `✅ Done (${selectedSubjects.length} selected)`, callback_data: 'onboard:subjects:done' }]);
  }
  return { inline_keyboard: rows };
}

export function practiceSubjectKeyboard(subjects: string[]) {
  const buttons = subjects.map(s => ({
    text: `${SUBJECT_EMOJI[s] || '📖'} ${s.charAt(0).toUpperCase() + s.slice(1)}`,
    callback_data: `practice:start:${s}`,
  }));
  const rows: any[][] = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  return { inline_keyboard: rows };
}
