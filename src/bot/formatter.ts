// src/bot/formatter.ts — All message templates
import { Question, User } from '../types';

// Telegram MarkdownV1 has no escape mechanism — sanitize all dynamic content
// by replacing the four special chars that cause "can't parse entities" errors.
function md(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/\*/g, '×')   // asterisk → multiplication sign
    .replace(/_/g, '-')    // underscore → hyphen
    .replace(/`/g, "'")    // backtick → apostrophe
    .replace(/\[/g, '(')   // open bracket → paren
    .replace(/\]/g, ')');  // close bracket → paren
}

export const SUBJECT_MAP: Record<string, string> = {
  english:          'English Language',
  math:             'Mathematics',
  biology:          'Biology',
  chemistry:        'Chemistry',
  physics:          'Physics',
  economics:        'Economics',
  government:       'Government',
  literature:       'Literature In English',
  geography:        'Geography',
  accounts:         'Accounts',
  crk:              'Christian Religious Knowledge',
  commerce:         'Commerce',
  agric:            'Agricultural Science',
  irk:              'Islamic Religious Knowledge',
  computer:         'Computer Studies',
  history:          'History',
  'further-math':   'Further Mathematics',
  'civic-education':'Civic Education',
  yoruba:           'Yoruba',
  marketing:        'Marketing',
  'data-processing':'Data Processing',
  hausa:            'Hausa',
  'home-economics': 'Home Economics',
  catering:         'Catering Craft Practice',
  pe:               'Physical Education',
  'animal-husbandry':'Animal Husbandry',
  igbo:             'Igbo',
  french:           'French',
  'office-practice':'Office Practice',
  insurance:        'Insurance',
  'fine-arts':      'Fine Arts',
  music:            'Music',
  arabic:           'Arabic',
  'book-keeping':   'Book Keeping',
};

export const SUBJECT_EMOJI: Record<string, string> = {
  english:          '📝',
  math:             '🔢',
  biology:          '🧬',
  chemistry:        '⚗️',
  physics:          '⚡',
  economics:        '📊',
  government:       '🏛️',
  literature:       '📚',
  geography:        '🌍',
  accounts:         '💰',
  crk:              '✝️',
  commerce:         '🏪',
  agric:            '🌾',
  irk:              '☪️',
  computer:         '💻',
  history:          '📜',
  'further-math':   '📐',
  'civic-education':'🗳️',
  yoruba:           '🗣️',
  marketing:        '📈',
  'data-processing':'🖥️',
  hausa:            '🗣️',
  'home-economics': '🏠',
  catering:         '🍳',
  pe:               '⚽',
  'animal-husbandry':'🐄',
  igbo:             '🗣️',
  french:           '🇫🇷',
  'office-practice':'📋',
  insurance:        '🛡️',
  'fine-arts':      '🎨',
  music:            '🎵',
  arabic:           '🕌',
  'book-keeping':   '📒',
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

${md(q.question_text)}`;
}

export function answerKeyboard(hasOptionE = false) {
  const rows: any[][] = [
    [
      { text: '🅰️  A', callback_data: 'answer:A' },
      { text: '🅱️  B', callback_data: 'answer:B' },
    ],
    [
      { text: '🅲  C', callback_data: 'answer:C' },
      { text: '🅳  D', callback_data: 'answer:D' },
    ],
  ];
  if (hasOptionE) rows.push([{ text: '🅴  E', callback_data: 'answer:E' }]);
  return { inline_keyboard: rows };
}

export function answerOptions(q: Question): string {
  let text = `\n\n*A.* ${md(q.option_a)}\n*B.* ${md(q.option_b)}\n*C.* ${md(q.option_c)}\n*D.* ${md(q.option_d)}`;
  if (q.option_e) text += `\n*E.* ${md(q.option_e)}`;
  return text;
}

export function correctAnswer(q: Question, selected: string): string {
  const wasCorrect = selected === q.correct_option;
  const emoji = wasCorrect ? '✅' : '❌';
  const header = wasCorrect
    ? `${emoji} *Correct! Well done.*`
    : `${emoji} *Wrong. The correct answer is ${q.correct_option}.*`;

  const optionText: Record<string, string | null> = {
    A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d, E: q.option_e,
  };

  return `${header}

✔️ *${q.correct_option}.* ${md(optionText[q.correct_option])}

💡 *Explanation:*
${md(q.explanation) || '_Explanation not yet available._'}`;
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
    inline_keyboard: [
      [
        { text: '➡️  Next Question', callback_data: 'practice:next' },
        { text: '🚩 Flag', callback_data: 'flag:question' },
      ],
      [
        { text: '📚 Change Subject', callback_data: 'practice:change_subject' },
        { text: '⏹  Stop', callback_data: 'practice:stop' },
      ],
    ],
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

export function sessionKeyboard(subject: string, year?: number | null) {
  const yearSuffix = year ? `:${year}` : ':any';
  return {
    inline_keyboard: [
      [
        { text: '🔄 Practice Again', callback_data: `practice:start:${subject}${yearSuffix}` },
        { text: '🎯 Drill Weak Topics', callback_data: `drill:auto:${subject}` },
      ],
      [
        { text: '📅 Change Year', callback_data: `practice:year:${subject}` },
        { text: '📚 Change Subject', callback_data: 'practice:change_subject' },
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
      [{ text: '📙 NECO', callback_data: 'onboard:exam:NECO' }],
      [{ text: '📚 All (WAEC, NECO & JAMB)', callback_data: 'onboard:exam:ALL' }],
    ],
  };
}

export const MAX_SUBJECTS = 5;    // including English
export const SUBJECT_Q_LIMIT = 5; // questions per subject per window
export const SUBJECT_WINDOW_HRS = 6;

export function subjectKeyboard(selectedSubjects: string[] = []) {
  const subjects = Object.entries(SUBJECT_MAP).map(([code, name]) => ({
    code,
    label: `${SUBJECT_EMOJI[code] || '📖'} ${name}`,
  }));

  const buttons = subjects.map(s => {
    const isEnglish = s.code === 'english';
    const isSelected = selectedSubjects.includes(s.code);
    return {
      // English shown as locked — tick + lock so user knows it can't be removed
      text: isEnglish
        ? `✅🔒 ${s.label}`
        : isSelected ? `✅ ${s.label}` : s.label,
      callback_data: `onboard:subject:${s.code}`,
    };
  });

  const rows: any[][] = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }
  // Show done button as soon as english is selected (always)
  const nonEnglish = selectedSubjects.filter(s => s !== 'english').length;
  rows.push([{
    text: `✅ Done (${selectedSubjects.length} selected, ${MAX_SUBJECTS - selectedSubjects.length} slots left)`,
    callback_data: 'onboard:subjects:done',
  }]);
  return { inline_keyboard: rows };
}

export function subjectLimitMessage(subjectName: string, msLeft: number): string {
  const hrs = Math.floor(msLeft / 3600000);
  const mins = Math.ceil((msLeft % 3600000) / 60000);
  const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins} min`;
  return `⏰ *Subject limit reached!*

You've used all ${SUBJECT_Q_LIMIT} free questions for *${subjectName}* in this ${SUBJECT_WINDOW_HRS}-hour window.

Resets in *${timeStr}*.

Switch to another subject or upgrade to Premium for unlimited access 👇`;
}

export function subjectLimitKeyboard(subject: string) {
  return {
    inline_keyboard: [
      [{ text: '📚 Switch Subject', callback_data: 'practice:change_subject' }],
      [{ text: '💎 Upgrade to Premium', callback_data: 'menu:subscribe' }],
    ],
  };
}

export function practiceSubjectKeyboard(subjects: string[]) {
  const buttons = subjects.map(s => ({
    text: `${SUBJECT_EMOJI[s] || '📖'} ${SUBJECT_MAP[s] || s.charAt(0).toUpperCase() + s.slice(1)}`,
    callback_data: `practice:year:${s}`, // → year picker
  }));
  const rows: any[][] = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  rows.push([
    { text: '➕ Add / Remove Subjects', callback_data: 'practice:add_subject' },
    { text: '🔄 Change Exam Type', callback_data: 'practice:change_exam' },
  ]);
  return { inline_keyboard: rows };
}

export function yearPickerKeyboard(subject: string) {
  const rows: any[][] = [
    [{ text: '📅 Any Year', callback_data: `practice:start:${subject}:any` }],
  ];
  const years: number[] = [];
  for (let y = 2025; y >= 2010; y--) years.push(y);
  for (let i = 0; i < years.length; i += 4) {
    rows.push(years.slice(i, i + 4).map(y => ({
      text: `${y}`,
      callback_data: `practice:start:${subject}:${y}`,
    })));
  }
  rows.push([{ text: '← Back to Subjects', callback_data: 'practice:pick' }]);
  return { inline_keyboard: rows };
}
