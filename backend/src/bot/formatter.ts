// src/bot/formatter.ts — All message templates
import { Question, User } from '../types';

// Convert LaTeX math notation to readable plain text for Telegram.
function convertLatex(text: string): string {
  return text
    // fractions: \frac{a}{b} → a/b
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1/$2)')
    // sqrt: \sqrt{x} → √x
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\sqrt\b/g, '√')
    // superscripts: ^{n} or ^n → unicode superscript where possible
    .replace(/\^\{([^}]+)\}/g, (_, e) => toSup(e))
    .replace(/\^(\w)/g, (_, e) => toSup(e))
    // subscripts: _{n} → unicode subscript where possible
    .replace(/_\{([^}]+)\}/g, (_, e) => toSub(e))
    .replace(/_(\w)/g, (_, e) => toSub(e))
    // common symbols
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\geq/g, '≥')
    .replace(/\\leq/g, '≤')
    .replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\infty/g, '∞')
    .replace(/\\pi/g, 'π')
    .replace(/\\theta/g, 'θ')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\mu/g, 'μ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\cdot/g, '·')
    .replace(/\\log/g, 'log')
    .replace(/\\ln/g, 'ln')
    .replace(/\\sin/g, 'sin')
    .replace(/\\cos/g, 'cos')
    .replace(/\\tan/g, 'tan')
    // arrays/tables: strip LaTeX table markup, keep values
    .replace(/\\begin\{array\}[\s\S]*?\\end\{array\}/g, (m) =>
      m.replace(/\\begin\{array\}\{[^}]*\}|\\end\{array\}|\\hline|\\multicolumn\{[^}]+\}\{[^}]+\}/g, '')
       .replace(/&/g, ' | ')
       .replace(/\\\\/g, '\n')
    )
    // strip remaining LaTeX delimiters \( \) \[ \]
    .replace(/\\\(|\\\)/g, '')
    .replace(/\\\[|\\\]/g, '')
    // strip remaining backslash commands
    .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z]+/g, '')
    // clean up extra spaces
    .replace(/ {2,}/g, ' ')
    .trim();
}

const SUP_MAP: Record<string, string> = {
  '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
  '+':'⁺','-':'⁻','n':'ⁿ','x':'ˣ',
};
const SUB_MAP: Record<string, string> = {
  '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉',
};
function toSup(s: string): string {
  const mapped = [...s].map(c => SUP_MAP[c] || c).join('');
  return mapped === s ? `^${s}` : mapped;
}
function toSub(s: string): string {
  const mapped = [...s].map(c => SUB_MAP[c] || c).join('');
  return mapped === s ? `_${s}` : mapped;
}

// HTML-escape dynamic DB content, render LaTeX math, and convert *word* markup to <u>word</u>.
function md(text: string | null | undefined): string {
  if (!text) return '';
  const mathConverted = convertLatex(text);
  return mathConverted
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*([^*\n]+)\*/g, '<u>$1</u>');
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
  return `🎓 <b>Welcome to ExamBuddie, ${firstName}!</b>

I'm your personal WAEC &amp; JAMB exam prep assistant. I'll give you past questions, explain every answer, and track your progress.

Let's set up your profile in 3 quick steps so I can tailor questions to your exam.

📅 <b>Step 1 of 3:</b> Which exam year are you preparing for?`;
}

export function onboardYearKeyboard() {
  const rows: any[][] = [
    [{ text: '📅 Any Year', callback_data: 'onboard:year:any' }],
  ];
  const years: number[] = [];
  for (let y = 2025; y >= 2010; y--) years.push(y);
  for (let i = 0; i < years.length; i += 4) {
    rows.push(years.slice(i, i + 4).map(y => ({
      text: `${y}`,
      callback_data: `onboard:year:${y}`,
    })));
  }
  return { inline_keyboard: rows };
}

export function askExamType(year: number | null): string {
  const yearLabel = year ? `📅 Year: <b>${year}</b>` : `📅 Year: <b>Any</b>`;
  return `✅ ${yearLabel}

📋 <b>Step 2 of 3:</b> Which exam are you preparing for?`;
}

export function askSubjects(examType: string): string {
  return `✅ <b>${examType} selected!</b>

📚 <b>Step 3 of 3:</b> Choose your subjects. You can pick multiple — I'll prepare questions for each one.`;
}

export function profileComplete(user: User): string {
  const subjects = user.subjects.map(s => SUBJECT_MAP[s] || s).join(', ');
  const yearLabel = user.target_year ? `<b>${user.target_year}</b>` : '<b>Any Year</b>';
  return `🎉 <b>You're all set, ${user.first_name}!</b>

📋 <b>Your Profile:</b>
• 📅 Exam Year: ${yearLabel}
• 📋 Exam: <b>${user.exam_type}</b>
• 📚 Subjects: ${subjects}

What would you like to do?`;
}

export function mainMenuKeyboard(plan?: string) {
  const isPremium = plan === 'premium';
  return {
    inline_keyboard: [
      [
        { text: '📚 Practice',   callback_data: 'practice:pick' },
        { text: '📋 Quiz Mode',  callback_data: 'quiz:pick' },
      ],
      [
        { text: '📊 My Stats',   callback_data: 'stats:show' },
        ...(isPremium ? [] : [{ text: '💎 Subscribe', callback_data: 'menu:subscribe' }]),
      ],
    ],
  };
}

export function persistentMenuKeyboard() {
  return {
    keyboard: [
      [{ text: '📚 Practice' }, { text: '📋 Quiz' }],
      [{ text: '📊 My Stats' }, { text: '⚙️ Settings' }],
    ],
    resize_keyboard: true,
    persistent: true,
  };
}

export function formatQuestion(q: Question, number: number, total: number | string, mode?: string): string {
  const modeTag = mode === 'quiz'
    ? `📋 <b>Question ${number}/${total}</b>`
    : mode === 'drill'
    ? `🎯 <b>Topic Drill: ${q.topic || 'Mixed'}</b>`
    : `📚 <b>Practice Mode</b>`;

  return `${modeTag}
<i>${q.exam_type} ${q.subject.charAt(0).toUpperCase() + q.subject.slice(1)} ${q.year}</i>

${md(q.question_text)}`;
}

export function answerKeyboard(hasOptionE = false) {
  const rows: any[][] = [
    [
      { text: 'A', callback_data: 'answer:A' },
      { text: 'B', callback_data: 'answer:B' },
    ],
    [
      { text: 'C', callback_data: 'answer:C' },
      { text: 'D', callback_data: 'answer:D' },
    ],
  ];
  if (hasOptionE) rows.push([{ text: 'E', callback_data: 'answer:E' }]);
  return { inline_keyboard: rows };
}

export function answerOptions(q: Question): string {
  let text = `\n\n<b>A.</b> ${md(q.option_a)}\n<b>B.</b> ${md(q.option_b)}\n<b>C.</b> ${md(q.option_c)}\n<b>D.</b> ${md(q.option_d)}`;
  if (q.option_e) text += `\n<b>E.</b> ${md(q.option_e)}`;
  return text;
}

export function correctAnswer(q: Question, selected: string): string {
  const wasCorrect = selected === q.correct_option;
  const emoji = wasCorrect ? '✅' : '❌';
  const header = wasCorrect
    ? `${emoji} <b>Correct! Well done.</b>`
    : `${emoji} <b>Wrong. The correct answer is ${q.correct_option}.</b>`;

  const optionText: Record<string, string | null> = {
    A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d, E: q.option_e,
  };

  return `${header}

✔️ <b>${q.correct_option}.</b> ${md(optionText[q.correct_option])}

💡 <b>Explanation:</b>
${md(q.explanation) || '<i>Explanation not yet available.</i>'}`;
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
  subjects,
  mode,
  durationSecs,
}: {
  correct: number;
  total: number;
  subject?: string;
  subjects?: string[];
  mode: string;
  durationSecs?: number;
}): string {
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const grade = accuracy >= 70 ? '🌟 Excellent!' : accuracy >= 50 ? '👍 Good effort!' : '💪 Keep practising!';
  const minutes = durationSecs ? Math.round(durationSecs / 60) : null;

  const subjectList = subjects && subjects.length > 0 ? subjects : (subject ? [subject] : []);
  const subjectLabel = subjectList.length > 1
    ? subjectList.map(s => SUBJECT_MAP[s] || s).join(', ')
    : SUBJECT_MAP[subjectList[0] || ''] || subjectList[0] || '';

  return `📊 <b>Session Summary</b>

${grade}

📌 Mode: ${mode.charAt(0).toUpperCase() + mode.slice(1)}
📚 Subject${subjectList.length > 1 ? 's' : ''}: ${subjectLabel}
✅ Correct: ${correct}/${total}
🎯 Accuracy: ${accuracy}%${minutes ? `\n⏱️ Time: ${minutes} min` : ''}

${accuracy < 50 ? '💡 <i>Tip: Try /drill to focus on specific weak topics.</i>' : ''}
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

export function examTypePickerKeyboard(mode: 'practice' | 'quiz') {
  return {
    inline_keyboard: [
      [
        { text: 'WAEC', callback_data: `${mode}:examtype:WAEC` },
        { text: 'NECO', callback_data: `${mode}:examtype:NECO` },
      ],
      [
        { text: 'JAMB', callback_data: `${mode}:examtype:JAMB` },
        { text: 'All Exams', callback_data: `${mode}:examtype:ALL` },
      ],
    ],
  };
}

export function timerPickerKeyboard(mode: 'practice' | 'quiz') {
  return {
    inline_keyboard: [
      [
        { text: '⏱️ 10 seconds', callback_data: `${mode}:timer:10` },
        { text: '⏱️ 20 seconds', callback_data: `${mode}:timer:20` },
      ],
      [
        { text: '⏱️ 30 seconds', callback_data: `${mode}:timer:30` },
        { text: '▶️ No Timer',   callback_data: `${mode}:timer:0`  },
      ],
    ],
  };
}

export function statsFilterKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: 'WAEC', callback_data: 'stats:filter:WAEC' },
        { text: 'NECO', callback_data: 'stats:filter:NECO' },
        { text: 'JAMB', callback_data: 'stats:filter:JAMB' },
      ],
      [{ text: 'All Exams', callback_data: 'stats:filter:all' }],
    ],
  };
}

export function statsMessage(user: User, stats: any, weakTopics?: any[], examType?: string, subjectStats?: any[]): string {
  const plan = user.plan === 'premium'
    ? `⭐ Premium (expires ${user.plan_expires_at ? new Date(user.plan_expires_at).toLocaleDateString('en-NG') : 'N/A'})`
    : '🆓 Free (5 questions/day)';

  const weakSection = weakTopics && weakTopics.length > 0
    ? '\n⚠️ <b>Weak Topics (focus here!):</b>\n' +
      weakTopics.map(t => `  • ${t.topic}: ${t.accuracy}% accuracy (${t.attempts} attempts)`).join('\n')
    : '';

  const examLabel = examType && examType !== 'all' ? examType : 'Overall';

  let subjectSection = '';
  if (subjectStats && subjectStats.length > 0) {
    const strong = subjectStats.filter(s => Number(s.accuracy) >= 60);
    const weak = subjectStats.filter(s => Number(s.accuracy) < 60);

    if (strong.length > 0) {
      subjectSection += '\n✅ <b>Strong Subjects:</b>\n' +
        strong.map(s => `  • ${s.subject}: ${s.accuracy}% (${s.attempts} attempts)`).join('\n');
    }
    if (weak.length > 0) {
      subjectSection += '\n❌ <b>Needs Work:</b>\n' +
        weak.map(s => `  • ${s.subject}: ${s.accuracy}% (${s.attempts} attempts)`).join('\n');
    }
  }

  return `📈 <b>Your ${examLabel} Stats</b>

👤 ${user.first_name}
📋 Exam: ${user.exam_type || 'Not set'}
🗓️ Joined: ${new Date(user.joined_at).toLocaleDateString('en-NG')}

📊 <b>${examLabel} Performance:</b>
• Total Attempts: ${stats.total_attempts || 0}
• Correct Answers: ${stats.correct || 0}
• Accuracy: ${stats.accuracy || 0}%
• 🔥 Streak: ${user.streak || 0} days

💳 <b>Plan:</b> ${plan}
${subjectSection}${weakSection}`;
}

export function freeLimitMessage(remaining: number, limit: number): string | null {
  if (remaining === 0) {
    return `⏰ <b>Daily limit reached!</b>

You've used all ${limit} free questions for today. Come back tomorrow, or upgrade to Premium for <b>unlimited access</b>.

💎 <b>ExamBuddie Premium:</b>
• Unlimited questions, every day
• Quiz mode &amp; Topic drills
• Progress tracking &amp; weak-topic detection
• Only ₦800/month or ₦7,000/year

👇 Tap to upgrade:`;
  }
  return null; // no message needed
}

export function upgradeMessage(): string {
  return `💎 <b>Upgrade to ExamBuddie Premium</b>

Unlock everything you need to ace your exams:

✅ Unlimited questions (no daily cap)
✅ Timed quiz mode (40 questions, 45 mins)
✅ Topic drill (target weak areas)
✅ Progress tracking &amp; stats
✅ Weak topic detection
✅ Priority support

💰 <b>Pricing:</b>
• Monthly: ₦800/month
• Yearly: ₦7,000/year <b>(save ₦2,600)</b>

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
  return `🔗 <b>Your Secure Payment Link</b>

Plan: ${planLabel}

👉 <a href="${link}">Click here to pay securely</a>

<i>Payment powered by Flutterwave. Your access will be activated instantly after payment.</i>

Reference: <code>${txRef}</code>`;
}

export function helpMessage(): string {
  return `📖 <b>ExamBuddie Commands</b>

<b>Practice:</b>
/practice — Start a practice session
/quiz — Take a 40-question timed mock exam
/drill [topic] — Drill a specific topic

<b>Account:</b>
/settings — Update your profile
/stats — View your progress
/subscribe — Upgrade to Premium

<b>Other:</b>
/stop — Stop current session
/help — Show this menu

💡 <b>Tip:</b> During practice, tap ➡️ for the next question or 🚩 to flag a wrong explanation.

Questions? DM @ExamBuddiSupport`;
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
export const SUBJECT_Q_LIMIT = 5; // questions per subject per 6-hour window
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
  return `⏰ <b>Subject limit reached!</b>

You've used all ${SUBJECT_Q_LIMIT} free questions for <b>${subjectName}</b> in this ${SUBJECT_WINDOW_HRS}-hour window.

Resets in <b>${timeStr}</b>.

Switch to another subject or upgrade to Premium for unlimited access 👇`;
}

export function subjectLimitKeyboard(subject: string, plan?: string) {
  const isPremium = plan === 'premium';
  return {
    inline_keyboard: [
      [{ text: '📚 Switch Subject', callback_data: 'practice:change_subject' }],
      ...(isPremium ? [] : [[{ text: '💎 Upgrade to Premium', callback_data: 'menu:subscribe' }]]),
    ],
  };
}

export function practiceSubjectKeyboard(subjects: string[]) {
  const buttons = subjects.map(s => ({
    text: `${SUBJECT_EMOJI[s] || '📖'} ${SUBJECT_MAP[s] || s.charAt(0).toUpperCase() + s.slice(1)}`,
    callback_data: `practice:subject:${s}`, // → uses saved target_year directly
  }));
  const rows: any[][] = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  rows.push([
    { text: '➕ Add / Remove Subjects', callback_data: 'practice:add_subject' },
    { text: '🔄 Change Exam Type', callback_data: 'practice:change_exam' },
  ]);
  return { inline_keyboard: rows };
}

export function practiceMultiSubjectKeyboard(allSubjects: string[], selected: string[]) {
  const buttons = allSubjects.map(s => {
    const isSelected = selected.includes(s);
    return {
      text: `${isSelected ? '✅ ' : ''}${SUBJECT_EMOJI[s] || '📖'} ${SUBJECT_MAP[s] || s}`,
      callback_data: `practice:multisubject:toggle:${s}`,
    };
  });
  const rows: any[][] = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  rows.push([{
    text: selected.length > 0
      ? `▶️ Start Practice (${selected.length} subject${selected.length > 1 ? 's' : ''})`
      : '⚠️ Select at least one subject',
    callback_data: 'practice:multisubject:start',
  }]);
  return { inline_keyboard: rows };
}

export function quizMultiSubjectKeyboard(allSubjects: string[], selected: string[]) {
  const buttons = allSubjects.map(s => {
    const isSelected = selected.includes(s);
    return {
      text: `${isSelected ? '✅ ' : ''}${SUBJECT_EMOJI[s] || '📖'} ${SUBJECT_MAP[s] || s}`,
      callback_data: `quiz:multisubject:toggle:${s}`,
    };
  });
  const rows: any[][] = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  rows.push([{
    text: selected.length > 0
      ? `▶️ Start Quiz (${selected.length} subject${selected.length > 1 ? 's' : ''})`
      : '⚠️ Select at least one subject',
    callback_data: 'quiz:multisubject:start',
  }]);
  return { inline_keyboard: rows };
}

export function flowYearKeyboard(mode: 'practice' | 'quiz') {
  const rows: any[][] = [
    [{ text: '📅 Any Year', callback_data: `${mode}:flow_year:any` }],
  ];
  const years: number[] = [];
  for (let y = 2025; y >= 2010; y--) years.push(y);
  for (let i = 0; i < years.length; i += 4) {
    rows.push(years.slice(i, i + 4).map(y => ({
      text: `${y}`,
      callback_data: `${mode}:flow_year:${y}`,
    })));
  }
  return { inline_keyboard: rows };
}

export function quizSubjectKeyboard(subjects: string[]) {
  const buttons = subjects.map(s => ({
    text: `${SUBJECT_EMOJI[s] || '📖'} ${SUBJECT_MAP[s] || s.charAt(0).toUpperCase() + s.slice(1)}`,
    callback_data: `quiz:subject:${s}`, // → uses saved target_year directly
  }));
  const rows: any[][] = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  rows.push([
    { text: '➕ Add / Remove Subjects', callback_data: 'practice:add_subject' },
    { text: '🔄 Change Exam Type', callback_data: 'practice:change_exam' },
  ]);
  return { inline_keyboard: rows };
}

export function topicKeyboard(topics: string[]) {
  const rows: any[][] = [
    [{ text: '📚 All Topics', callback_data: 'practice:topic:__all__' }],
  ];
  for (let i = 0; i < topics.length; i += 2) {
    rows.push(topics.slice(i, i + 2).map(t => ({
      text: t,
      callback_data: `practice:topic:${t}`,
    })));
  }
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
