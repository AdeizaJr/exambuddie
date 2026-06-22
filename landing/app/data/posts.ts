export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "callout"; text: string }
  | { type: "cta"; text: string; href: string };

export type Post = {
  slug: string;
  title: string;
  description: string;
  date: string;
  readingMinutes: number;
  keywords: string[];
  blocks: Block[];
};

const BOT_URL = "https://t.me/ExamBuddieBot?start=from_blog";

export const posts: Post[] = [
  {
    slug: "how-to-score-300-in-jamb-utme-2026",
    title: "How to Score 300+ in JAMB UTME 2026: A Complete Study Guide",
    description:
      "Practical strategies to score 300 and above in the 2026 JAMB UTME. Past questions, time management, spaced repetition, and a week-by-week plan.",
    date: "2026-05-01",
    readingMinutes: 7,
    keywords: [
      "how to score 300 in JAMB",
      "JAMB UTME 2026 study guide",
      "JAMB preparation tips",
      "JAMB past questions strategy",
      "score 300 JAMB Nigeria",
    ],
    blocks: [
      {
        type: "p",
        text: "Scoring 300 and above in JAMB UTME puts you in the top 5% of candidates. It is not luck — it is a repeatable process. This guide breaks down exactly what that process looks like, from your first week of revision to the morning of the exam.",
      },
      { type: "h2", text: "Understand What JAMB Actually Tests" },
      {
        type: "p",
        text: "JAMB UTME is a 100-question, 120-minute Computer Based Test across your four chosen subjects. Each question is worth 2.5 marks — no negative marking. The exam does not test memory alone. It tests how quickly you can identify the right concept under time pressure.",
      },
      {
        type: "p",
        text: "The most important insight: 70–80% of JAMB questions follow patterns from previous years. Students who have seen those patterns before perform significantly better. This is why past question practice is the single most effective preparation strategy.",
      },
      { type: "h2", text: "Choose Your Four Subjects Strategically" },
      {
        type: "p",
        text: "English Language is compulsory. Your other three depend on your course. If you are applying for a science course, Mathematics, Biology, Chemistry, and Physics are typical. Commerce students commonly take Economics, Accounts, and Commerce or Government.",
      },
      {
        type: "callout",
        text: "Tip: Pick subjects you are already strongest in. A weak compulsory subject can still be drilled to passing level, but a strong optional subject adds more total marks faster.",
      },
      { type: "h2", text: "Build a Daily Practice Habit — Not a Cramming Session" },
      {
        type: "p",
        text: "The biggest mistake JAMB candidates make is saving all studying for the final two weeks. Memory does not work like a hard drive. Information crammed in one session fades within 24 hours. What sticks is what you revisit repeatedly over time.",
      },
      {
        type: "p",
        text: "The most effective study schedule looks like this: 30–60 minutes of practice every day for 8–12 weeks. That is about 60–100 hours of deliberate practice — the same volume as cramming for 6 straight days, except spread out so it actually transfers to long-term memory.",
      },
      {
        type: "ul",
        items: [
          "Practice 20–30 questions per day minimum",
          "Rotate through all four subjects weekly",
          "Read every explanation, even for correct answers",
          "Track your accuracy per subject — not just total score",
        ],
      },
      { type: "h2", text: "Target Your Weak Topics First" },
      {
        type: "p",
        text: "Most students practise what they already know because it feels good to answer correctly. This is the wrong approach. Every hour you spend on a topic you already understand at 85% accuracy is an hour not spent on a topic you score 40% on.",
      },
      {
        type: "p",
        text: "Identify your three weakest topics per subject. Drill those until your accuracy improves to 70%+. Then move to the next weakest. This approach consistently produces larger score improvements than general revision.",
      },
      {
        type: "callout",
        text: "ExamBuddie automatically detects your weak topics from your practice history and drills them until you improve — you don't have to track this manually.",
      },
      { type: "h2", text: "Master JAMB Time Management" },
      {
        type: "p",
        text: "120 minutes for 100 questions means 72 seconds per question. In practice, aim to spend 45–60 seconds on each question and use the remaining time to review flagged ones. Students who run out of time leave easy marks on the table.",
      },
      {
        type: "ol",
        items: [
          "Answer questions you know immediately — do not overthink",
          "Skip and flag difficult questions — come back after finishing the rest",
          "Never spend more than 2 minutes on a single question",
          "With 15 minutes left, go back to all flagged questions",
          "If truly stuck, eliminate wrong options and guess — no penalty for wrong answers",
        ],
      },
      { type: "h2", text: "Take Full Mock Exams Before the Real Thing" },
      {
        type: "p",
        text: "Practising individual questions is not the same as sitting a full 100-question exam under time pressure. The mental fatigue, the clock counting down, the pressure of seeing your score — these need to feel familiar before the real exam, not new.",
      },
      {
        type: "p",
        text: "In the final three weeks before your UTME, take at least two full mock exams per week. After each one, review every question you got wrong and identify the pattern: was it a knowledge gap, a reading error, or time pressure?",
      },
      { type: "h2", text: "The Week Before Your UTME" },
      {
        type: "ul",
        items: [
          "Stop learning new material — only review",
          "Do one final mock exam 3 days before",
          "Rest the day before — fatigue costs marks",
          "Arrive at the exam centre early — technical issues do not pause your clock",
          "Read every question carefully — JAMB wording is deliberately precise",
        ],
      },
      {
        type: "cta",
        text: "Start practising JAMB past questions free on Telegram →",
        href: BOT_URL,
      },
    ],
  },
  {
    slug: "waec-2026-how-to-prepare",
    title: "WAEC 2026: What to Expect and How to Prepare",
    description:
      "Everything SS3 students need to know about WAEC 2026 — exam structure, high-yield topics, past question strategy, and a realistic preparation plan.",
    date: "2026-05-10",
    readingMinutes: 6,
    keywords: [
      "how to prepare for WAEC 2026",
      "WAEC 2026 preparation guide",
      "WAEC past questions strategy",
      "WAEC study plan Nigeria",
      "WAEC tips for SS3 students",
    ],
    blocks: [
      {
        type: "p",
        text: "The West African Senior School Certificate Examination (WAEC) remains the most important academic milestone for Nigerian secondary school students. Your WAEC result is what universities, polytechnics, and employers see first. Here is how to approach 2026.",
      },
      { type: "h2", text: "How WAEC Is Structured" },
      {
        type: "p",
        text: "WAEC tests both theory (essay/structured) and objective (multiple-choice) components for most subjects. The objective section is where past question practice pays off most directly — the question formats repeat year after year.",
      },
      {
        type: "p",
        text: "Most subjects are examined over two papers: Paper 1 (objective) and Paper 2 (theory/essay). Some subjects like Mathematics and English have additional components. Check the WAEC timetable early so you know which papers fall on which day.",
      },
      { type: "h2", text: "The High-Yield Subjects to Prioritise" },
      {
        type: "p",
        text: "All subjects matter, but some have heavier weighting in university admission requirements. Mathematics and English Language are compulsory for virtually every tertiary institution. Science students need at least a credit in Biology, Chemistry, and Physics.",
      },
      {
        type: "callout",
        text: "Rule of thumb: Aim for A or B in your best 3 subjects and at least a C in Mathematics and English. Universities calculate aggregate scores — your top subjects matter more than your weakest.",
      },
      { type: "h2", text: "Why Past Questions Work for WAEC" },
      {
        type: "p",
        text: "WAEC questions are set by subject experts who follow a defined syllabus and question format. This means the types of questions, the way they are phrased, and the topics they cover follow predictable patterns across years. A student who has practised 500 WAEC Mathematics questions from 2015–2025 will recognise most question types in the exam.",
      },
      {
        type: "ul",
        items: [
          "Familiar question types reduce panic and improve speed",
          "Past questions reveal which topics appear most frequently",
          "Reading explanations builds deeper understanding than textbook reading alone",
          "Tracking your accuracy shows exactly where you need more work",
        ],
      },
      { type: "h2", text: "A Realistic WAEC Study Plan" },
      {
        type: "p",
        text: "If your WAEC starts in May, you have roughly 4 months from January. Here is a realistic weekly breakdown:",
      },
      {
        type: "ol",
        items: [
          "January–February: Cover syllabus content for all subjects. Practice 10–15 past questions per subject per day.",
          "March: Shift to 70% past question practice, 30% content review. Identify your 3 weakest topics per subject.",
          "April: Drill weak topics intensively. Take two full timed mock exams per week.",
          "Final 2 weeks: Review only. No new material. Rest the day before each paper.",
        ],
      },
      { type: "h2", text: "Common WAEC Mistakes to Avoid" },
      {
        type: "ul",
        items: [
          "Reading without practising — passive revision does not prepare you for timed questions",
          "Skipping subjects you dislike — one failure can cost your full certificate",
          "Memorising answers without understanding — WAEC rephrases questions to test understanding",
          "Starting mock exams too late — time pressure needs to feel familiar before the real exam",
          "Ignoring the theory paper — the objective section is only half your mark",
        ],
      },
      { type: "h2", text: "What to Do in the Exam Hall" },
      {
        type: "ul",
        items: [
          "Read each question completely before answering",
          "In the objective section, eliminate obviously wrong options first",
          "In theory, answer the questions you know best first to secure marks",
          "Never leave an objective question blank — guess if you must",
          "Manage time strictly — know how many minutes per question you can afford",
        ],
      },
      {
        type: "cta",
        text: "Start practising WAEC past questions free on Telegram →",
        href: BOT_URL,
      },
    ],
  },
  {
    slug: "neco-vs-waec-differences-and-how-to-prepare",
    title: "NECO vs WAEC: Key Differences and How to Prepare for Both",
    description:
      "NECO and WAEC are both Nigerian school-leaving exams but differ in format, timing, and acceptance. Here is everything you need to know to pass both.",
    date: "2026-05-20",
    readingMinutes: 5,
    keywords: [
      "NECO vs WAEC difference",
      "NECO or WAEC which is better",
      "can I use NECO instead of WAEC",
      "NECO WAEC preparation Nigeria",
      "NECO SSCE difference",
    ],
    blocks: [
      {
        type: "p",
        text: "Many Nigerian SS3 students sit both WAEC and NECO in the same year. Both award the SSCE (Senior School Certificate), both are accepted by Nigerian universities, and both test the same subjects. But there are important differences in format, marking, and timing.",
      },
      { type: "h2", text: "What Is WAEC?" },
      {
        type: "p",
        text: "The West African Examinations Council (WAEC) has been conducting the SSCE since 1952. It is the older, more widely recognised examination and is accepted in Nigeria, Ghana, Sierra Leone, Liberia, and The Gambia. WAEC typically runs May–June each year.",
      },
      { type: "h2", text: "What Is NECO?" },
      {
        type: "p",
        text: "The National Examinations Council (NECO) was established in 1999 by the Nigerian government specifically to serve Nigerian students. NECO runs June–July each year, a few weeks after WAEC. Because it is strictly Nigerian, NECO results are accepted by all Nigerian tertiary institutions but not by universities in other West African countries.",
      },
      { type: "h2", text: "Key Differences" },
      {
        type: "ul",
        items: [
          "Timing: WAEC is May–June; NECO is June–July",
          "Recognition: WAEC is West Africa-wide; NECO is Nigeria-only",
          "Question style: WAEC tends to have more application-based questions; NECO questions often test direct recall",
          "Marking: Both use similar grading (A1–F9) but their cutoff raw scores differ per year",
          "Cost: NECO registration fees are generally lower than WAEC",
        ],
      },
      { type: "h2", text: "Do You Need Both?" },
      {
        type: "p",
        text: "No law says you must sit both. However, many students write both because: (1) if you miss a grade in WAEC, NECO gives you a second chance in the same year; (2) some courses require you to present results from at least two sittings if one is pending.",
      },
      {
        type: "callout",
        text: "If you are aiming for medicine, law, or engineering at a federal university, check the specific O'level requirements for that school. Some require 5 credits including English and Maths in not more than two sittings — and one sitting is always better.",
      },
      { type: "h2", text: "How Past Questions Differ Between NECO and WAEC" },
      {
        type: "p",
        text: "WAEC questions tend to be more application-heavy — they present scenarios and ask you to apply knowledge. NECO questions are more frequently direct: define, list, state. Both follow the national syllabus, so content overlap is very high.",
      },
      {
        type: "p",
        text: "The smart approach: practice past questions from both exams. WAEC practice builds deeper understanding. NECO practice trains recall speed. Combined, they cover the full range of question styles you will see.",
      },
      { type: "h2", text: "Preparing for Both in the Same Year" },
      {
        type: "ol",
        items: [
          "Prepare content by subject — the syllabus is the same for both exams",
          "Practice WAEC past questions first (May deadline) with focus on application",
          "In the weeks between WAEC and NECO, shift to NECO-style direct-recall practice",
          "Use your WAEC experience to identify which topics you still need to strengthen",
          "Take at least two full NECO mock exams before the real exam",
        ],
      },
      {
        type: "cta",
        text: "Practice NECO and WAEC past questions in one place →",
        href: BOT_URL,
      },
    ],
  },
  {
    slug: "5-study-habits-top-waec-jamb-students",
    title: "5 Study Habits That Top WAEC and JAMB Students Use",
    description:
      "The students who score highest in WAEC and JAMB are not necessarily the smartest — they study smarter. Here are the five habits that consistently produce top results.",
    date: "2026-06-01",
    readingMinutes: 5,
    keywords: [
      "WAEC study habits",
      "JAMB study tips Nigeria",
      "how to study for WAEC and JAMB",
      "best study methods for Nigerian exams",
      "active recall WAEC",
    ],
    blocks: [
      {
        type: "p",
        text: "Ask any student who scores A1 in WAEC or 320+ in JAMB how they did it, and you will hear the same themes. Not more hours — smarter hours. Not harder effort — better systems. Here are the five habits that consistently separate top performers from average ones.",
      },
      { type: "h2", text: "1. They Practice Questions, Not Just Read Notes" },
      {
        type: "p",
        text: "Passive revision — reading your textbook, copying notes — feels productive but is one of the least effective ways to retain information. Active recall — being forced to retrieve an answer from memory — is far more powerful.",
      },
      {
        type: "p",
        text: "Top students spend 60–70% of their study time answering questions, not reading. Every time you answer a question (even incorrectly), your brain works harder to retain that information than it does when you passively read the correct answer.",
      },
      {
        type: "callout",
        text: "Rule: For every 30 minutes of textbook reading, spend 30 minutes answering past questions on that material. Do not skip straight to the answer key — attempt every question first.",
      },
      { type: "h2", text: "2. They Use Spaced Repetition" },
      {
        type: "p",
        text: "Cramming the night before works for one day. Spaced repetition works for the exam. The principle is simple: review material at increasing intervals. See something on Day 1, review on Day 3, then Day 7, then Day 21. Each review strengthens the memory trace.",
      },
      {
        type: "p",
        text: "In practice, this means: when you get a question wrong today, it should come back tomorrow. When you get it right twice, it comes back next week. This is why digital tools that track your wrong answers and resurface them are so much more efficient than static past question booklets.",
      },
      { type: "h2", text: "3. They Target Weak Topics, Not Favourite Ones" },
      {
        type: "p",
        text: "Comfort zone studying is the enemy of improvement. Practising topics you already know feels good but produces minimal score gains. The student who practises Quadratic Equations for two hours when their accuracy is already 85% is wasting time that could add 10 marks elsewhere.",
      },
      {
        type: "ul",
        items: [
          "After every practice session, note which topics you missed",
          "Rank your topics from lowest to highest accuracy",
          "Spend the most time on the bottom three topics per subject",
          "Only move to a new weak topic after the current one improves to 70%+",
        ],
      },
      { type: "h2", text: "4. They Practise Under Timed Conditions" },
      {
        type: "p",
        text: "There is a significant difference between answering questions with no time limit and answering them with a clock running. The first builds understanding. The second builds exam readiness. You need both.",
      },
      {
        type: "p",
        text: "In the final month before WAEC or JAMB, take at least two timed mock exams per week — full length, full time limit, no interruptions. The goal is to make exam pressure feel familiar. Panic costs marks. Familiarity removes panic.",
      },
      { type: "h2", text: "5. They Show Up Every Day — Even Briefly" },
      {
        type: "p",
        text: "Consistency beats intensity. A student who studies for 45 minutes every day for 90 days will outperform a student who studies for 8 hours on weekends only — even though the total hours are similar. Daily practice keeps knowledge fresh and builds exam-day confidence gradually.",
      },
      {
        type: "p",
        text: "The simplest system: a non-negotiable minimum. Even on bad days — 10 questions. That is it. The habit of showing up every day is more valuable than the specific volume on any single day.",
      },
      {
        type: "callout",
        text: "ExamBuddie tracks your streak — the number of consecutive days you have practised. Students on streaks of 30+ days consistently report higher mock exam scores. The streak itself becomes motivation.",
      },
      {
        type: "cta",
        text: "Build your study streak — start practising free on Telegram →",
        href: BOT_URL,
      },
    ],
  },
];
