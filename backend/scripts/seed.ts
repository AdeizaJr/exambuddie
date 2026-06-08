// scripts/seed.ts — Seeds subjects + sample questions for all 9 subjects
import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const subjects = [
  { code: 'english',    name: 'English Language',    emoji: '📝' },
  { code: 'math',       name: 'Mathematics',          emoji: '🔢' },
  { code: 'biology',    name: 'Biology',              emoji: '🧬' },
  { code: 'chemistry',  name: 'Chemistry',            emoji: '⚗️' },
  { code: 'physics',    name: 'Physics',              emoji: '⚡' },
  { code: 'economics',  name: 'Economics',            emoji: '📊' },
  { code: 'government', name: 'Government',           emoji: '🏛️' },
  { code: 'literature', name: 'Literature in English',emoji: '📚' },
  { code: 'geography',  name: 'Geography',            emoji: '🌍' },
];

// Sample questions — representative of WAEC/JAMB style
// In production, this would be ~9,000 entries from the import pipeline
const sampleQuestions = [
  // ENGLISH
  {
    exam_type: 'WAEC', subject: 'english', year: 2023, topic: 'Comprehension',
    question_text: 'Choose the word that is most nearly OPPOSITE in meaning to the word in capitals.\n\nThe politician gave a VERBOSE speech that bored the audience.',
    option_a: 'Concise', option_b: 'Elaborate', option_c: 'Passionate', option_d: 'Memorable',
    correct_option: 'A',
    explanation: 'VERBOSE means using more words than needed; wordy. Its antonym (opposite) is CONCISE, meaning brief and to the point. "Elaborate" and "Elaborate" actually share similar meaning to verbose. "Passionate" and "Memorable" relate to tone/impact, not word count.',
    explanation_reviewed: true,
  },
  {
    exam_type: 'WAEC', subject: 'english', year: 2022, topic: 'Grammar',
    question_text: 'Select the option that best completes the sentence.\n\nNeither the students nor the teacher ______ present when the principal arrived.',
    option_a: 'were', option_b: 'was', option_c: 'are', option_d: 'have been',
    correct_option: 'B',
    explanation: 'With "neither...nor", the verb agrees with the subject closest to it — in this case, "the teacher" (singular). Therefore, we use "was" (singular past tense). If it were "neither the teacher nor the students", the answer would be "were".',
    explanation_reviewed: true,
  },
  {
    exam_type: 'JAMB', subject: 'english', year: 2023, topic: 'Lexis',
    question_text: 'In the sentence below, choose the option nearest in meaning to the underlined word.\n\n"The judge gave an *equivocal* ruling that left both sides confused."',
    option_a: 'Decisive', option_b: 'Ambiguous', option_c: 'Lengthy', option_d: 'Unfair',
    correct_option: 'B',
    explanation: '"Equivocal" means open to more than one interpretation; ambiguous. It comes from Latin "aequi" (equal) + "vox" (voice) — literally "equal voices" pointing in different directions. The ruling confused both parties because it was unclear, which matches "ambiguous".',
    explanation_reviewed: true,
  },

  // MATHEMATICS
  {
    exam_type: 'WAEC', subject: 'math', year: 2023, topic: 'Algebra',
    question_text: 'Solve for x: 3x² - 12x + 9 = 0',
    option_a: 'x = 1 or x = 3', option_b: 'x = -1 or x = -3', option_c: 'x = 2 or x = 3', option_d: 'x = 0 or x = 3',
    correct_option: 'A',
    explanation: 'Step 1: Divide all terms by 3: x² - 4x + 3 = 0\nStep 2: Factorise: (x - 1)(x - 3) = 0\nStep 3: Solve each factor: x - 1 = 0 → x = 1; x - 3 = 0 → x = 3\nAnswer: x = 1 or x = 3\n\nVerify: 3(1)² - 12(1) + 9 = 3 - 12 + 9 = 0 ✓; 3(9) - 12(3) + 9 = 27 - 36 + 9 = 0 ✓',
    explanation_reviewed: true,
  },
  {
    exam_type: 'WAEC', subject: 'math', year: 2022, topic: 'Statistics',
    question_text: 'The mean of 5 numbers is 8. If four of the numbers are 6, 9, 11, and 7, find the fifth number.',
    option_a: '5', option_b: '7', option_c: '8', option_d: '9',
    correct_option: 'B',
    explanation: 'Step 1: Mean = Sum ÷ Count, so Sum = Mean × Count = 8 × 5 = 40\nStep 2: Sum of the four known numbers = 6 + 9 + 11 + 7 = 33\nStep 3: Fifth number = Total sum - Known sum = 40 - 33 = 7\nAnswer: The fifth number is 7.',
    explanation_reviewed: true,
  },
  {
    exam_type: 'JAMB', subject: 'math', year: 2023, topic: 'Geometry',
    question_text: 'A circle has a circumference of 44 cm. Find its area. (Take π = 22/7)',
    option_a: '154 cm²', option_b: '176 cm²', option_c: '308 cm²', option_d: '88 cm²',
    correct_option: 'A',
    explanation: 'Step 1: Find radius from circumference. C = 2πr → 44 = 2 × (22/7) × r → r = 44 × 7 / 44 = 7 cm\nStep 2: Area = πr² = (22/7) × 7² = (22/7) × 49 = 22 × 7 = 154 cm²\nAnswer: 154 cm²',
    explanation_reviewed: true,
  },

  // BIOLOGY
  {
    exam_type: 'WAEC', subject: 'biology', year: 2023, topic: 'Cell Biology',
    question_text: 'Which organelle is responsible for the synthesis of proteins in a cell?',
    option_a: 'Mitochondria', option_b: 'Ribosome', option_c: 'Golgi apparatus', option_d: 'Lysosome',
    correct_option: 'B',
    explanation: 'Ribosomes are the sites of protein synthesis. They read mRNA sequences and assemble amino acids into polypeptide chains. They can be free in the cytoplasm (for proteins used within the cell) or attached to the Rough ER (for proteins to be exported). Mitochondria produce energy (ATP); Golgi apparatus packages proteins; Lysosomes break down waste.',
    explanation_reviewed: true,
  },
  {
    exam_type: 'JAMB', subject: 'biology', year: 2022, topic: 'Genetics',
    question_text: 'In a cross between a tall plant (TT) and a short plant (tt), what percentage of the F2 generation will be short?',
    option_a: '0%', option_b: '25%', option_c: '50%', option_d: '75%',
    correct_option: 'B',
    explanation: 'F1 generation: TT × tt → all Tt (tall, since T is dominant)\nF2 generation: Tt × Tt → TT : Tt : tt = 1:2:1\nSo: 1 TT (tall), 2 Tt (tall), 1 tt (short)\nShort plants (tt) = 1 out of 4 = 25%\nThe ratio of tall to short in F2 is 3:1.',
    explanation_reviewed: true,
  },

  // CHEMISTRY
  {
    exam_type: 'WAEC', subject: 'chemistry', year: 2023, topic: 'Atomic Structure',
    question_text: 'The atomic number of an element is 17. How many electrons are in its outermost shell?',
    option_a: '5', option_b: '6', option_c: '7', option_d: '8',
    correct_option: 'C',
    explanation: 'Atomic number 17 = Chlorine (Cl). Electron configuration: 2, 8, 7\nShell 1: 2 electrons; Shell 2: 8 electrons; Shell 3 (outermost): 7 electrons\nThis is why Chlorine is so reactive — it needs just 1 more electron to complete its outer shell and form Cl⁻.',
    explanation_reviewed: true,
  },
  {
    exam_type: 'JAMB', subject: 'chemistry', year: 2023, topic: 'Acids and Bases',
    question_text: 'What is the pH of a solution with hydrogen ion concentration [H⁺] = 1 × 10⁻⁹ mol/dm³?',
    option_a: '5', option_b: '7', option_c: '9', option_d: '11',
    correct_option: 'C',
    explanation: 'pH = -log[H⁺] = -log(1 × 10⁻⁹) = -(-9) = 9\nA pH of 9 is basic/alkaline (above 7). This makes sense because low [H⁺] concentration means fewer acid particles, so the solution is alkaline.',
    explanation_reviewed: true,
  },

  // PHYSICS
  {
    exam_type: 'WAEC', subject: 'physics', year: 2023, topic: 'Mechanics',
    question_text: 'A car accelerates uniformly from rest to 20 m/s in 5 seconds. What is the acceleration?',
    option_a: '2 m/s²', option_b: '4 m/s²', option_c: '5 m/s²', option_d: '100 m/s²',
    correct_option: 'B',
    explanation: 'Using the equation: a = (v - u) / t\nWhere: v = final velocity = 20 m/s; u = initial velocity = 0 (from rest); t = time = 5 s\na = (20 - 0) / 5 = 20 / 5 = 4 m/s²\nThe car gains 4 metres per second of speed every second.',
    explanation_reviewed: true,
  },
  {
    exam_type: 'JAMB', subject: 'physics', year: 2022, topic: 'Waves',
    question_text: 'A wave has a frequency of 50 Hz and a wavelength of 4 m. What is its speed?',
    option_a: '12.5 m/s', option_b: '46 m/s', option_c: '54 m/s', option_d: '200 m/s',
    correct_option: 'D',
    explanation: 'Wave speed formula: v = f × λ\nWhere: f = frequency = 50 Hz; λ (lambda) = wavelength = 4 m\nv = 50 × 4 = 200 m/s\nRemember: frequency is cycles per second (Hz), wavelength is the distance per cycle (m), so their product gives distance per second (m/s).',
    explanation_reviewed: true,
  },

  // ECONOMICS
  {
    exam_type: 'WAEC', subject: 'economics', year: 2023, topic: 'Demand and Supply',
    question_text: 'When the price of a good rises and demand falls, this is an example of:',
    option_a: 'An increase in demand', option_b: 'A decrease in demand', option_c: 'A contraction in demand', option_d: 'An extension in demand',
    correct_option: 'C',
    explanation: 'Key distinction: A *movement along* the demand curve (caused by a price change) is called a contraction (price up → quantity down) or extension (price down → quantity up). A *shift of* the demand curve is called an increase or decrease in demand, caused by non-price factors (income, tastes, substitutes). Here, price rose → quantity demanded fell = CONTRACTION in demand.',
    explanation_reviewed: true,
  },
  {
    exam_type: 'JAMB', subject: 'economics', year: 2023, topic: 'National Income',
    question_text: 'Which of the following is NOT included in the calculation of Gross Domestic Product (GDP)?',
    option_a: 'Government spending', option_b: 'Household consumption', option_c: 'Transfer payments', option_d: 'Net exports',
    correct_option: 'C',
    explanation: 'GDP = C + I + G + (X - M) where: C = Consumption, I = Investment, G = Government spending, X-M = Net exports\nTransfer payments (pensions, unemployment benefits, scholarships) are NOT included because they are not payment for current production of goods or services — no new value is created. Including them would cause double-counting.',
    explanation_reviewed: true,
  },

  // GOVERNMENT
  {
    exam_type: 'WAEC', subject: 'government', year: 2023, topic: 'Nigerian Constitution',
    question_text: 'The 1999 Constitution of Nigeria established which type of government?',
    option_a: 'Unitary', option_b: 'Confederate', option_c: 'Federal', option_d: 'Parliamentary',
    correct_option: 'C',
    explanation: 'Nigeria operates a Federal system of government, established by the 1999 Constitution (as amended). Power is divided between the Federal Government, 36 State Governments, and 774 Local Government Areas. This is distinct from: Unitary (power centralised, e.g. UK), Confederate (states are primary, e.g. historical USA), and Parliamentary (legislature and executive fused, e.g. UK).',
    explanation_reviewed: true,
  },
  {
    exam_type: 'JAMB', subject: 'government', year: 2022, topic: 'Electoral Systems',
    question_text: 'In which electoral system does a candidate win by obtaining more than half of the total votes cast?',
    option_a: 'First-past-the-post', option_b: 'Proportional representation', option_c: 'Absolute majority', option_d: 'Simple majority',
    correct_option: 'C',
    explanation: 'Absolute Majority (also called Majority System) requires a candidate to win more than 50% of all votes cast. Simple majority (first-past-the-post) only requires more votes than any other candidate — even if below 50%. Proportional representation allocates seats based on vote share. Nigeria\'s presidential elections use absolute majority (plus 25% of votes in 2/3 of states).',
    explanation_reviewed: true,
  },

  // LITERATURE
  {
    exam_type: 'WAEC', subject: 'literature', year: 2023, topic: 'Literary Devices',
    question_text: 'Identify the literary device in this line: "The wind whispered secrets through the trees."',
    option_a: 'Simile', option_b: 'Metaphor', option_c: 'Personification', option_d: 'Alliteration',
    correct_option: 'C',
    explanation: 'Personification gives human qualities to non-human things. Here, "whispered secrets" attributes a human action (whispering) to the wind. This is not a simile (no "like" or "as"), not a metaphor (not saying wind IS something else), and not alliteration (no repeated consonant sounds).',
    explanation_reviewed: true,
  },
  {
    exam_type: 'JAMB', subject: 'literature', year: 2022, topic: 'Drama',
    question_text: 'A speech delivered by a character alone on stage to reveal their thoughts to the audience is called:',
    option_a: 'Dialogue', option_b: 'Soliloquy', option_c: 'Aside', option_d: 'Monologue',
    correct_option: 'B',
    explanation: 'A Soliloquy is when a character speaks alone on stage — other characters are absent — revealing inner thoughts directly to the audience (e.g., Hamlet\'s "To be or not to be"). An Aside is a brief private comment to the audience while others are on stage. A Monologue is a long speech by one character (others may be present). Dialogue is conversation between two or more characters.',
    explanation_reviewed: true,
  },

  // GEOGRAPHY
  {
    exam_type: 'WAEC', subject: 'geography', year: 2023, topic: 'Climate',
    question_text: 'Which type of rainfall is caused by the meeting of two air masses of different temperatures?',
    option_a: 'Convectional', option_b: 'Relief (orographic)', option_c: 'Cyclonic (frontal)', option_d: 'Monsoon',
    correct_option: 'C',
    explanation: 'Cyclonic (Frontal) rainfall: When a warm air mass meets a cold air mass, the warmer, lighter air is forced upward over the denser cold air. As it rises, it cools, condenses, and falls as rain. Convectional = heated ground warms air which rises. Relief/Orographic = air forced over mountains. Monsoon refers to seasonal wind patterns, not a rainfall mechanism.',
    explanation_reviewed: true,
  },
  {
    exam_type: 'JAMB', subject: 'geography', year: 2022, topic: 'Population',
    question_text: 'The process by which people move from rural areas to urban centres in search of better opportunities is called:',
    option_a: 'Emigration', option_b: 'Immigration', option_c: 'Rural-urban migration', option_d: 'Urbanisation',
    correct_option: 'C',
    explanation: 'Rural-urban migration specifically describes the movement of people FROM rural/countryside areas TO urban/city areas. Urbanisation is the broader process of cities growing (can include birth rates). Emigration = leaving a country; Immigration = entering a country. Nigeria has experienced massive rural-urban migration, driving the rapid growth of Lagos, Abuja, and Kano.',
    explanation_reviewed: true,
  },
];

async function seed(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding database...\n');

    // Subjects
    console.log('📚 Inserting subjects...');
    for (const s of subjects) {
      await client.query(
        `INSERT INTO subjects (code, name, emoji) VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET name = $2, emoji = $3`,
        [s.code, s.name, s.emoji]
      );
    }
    console.log(`  ✓ ${subjects.length} subjects seeded`);

    // Questions
    console.log('\n❓ Inserting sample questions...');
    let count = 0;
    for (const q of sampleQuestions) {
      await client.query(
        `INSERT INTO questions
          (exam_type, subject, year, topic, question_text,
           option_a, option_b, option_c, option_d,
           correct_option, explanation, explanation_reviewed)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [q.exam_type, q.subject, q.year, q.topic, q.question_text,
         q.option_a, q.option_b, q.option_c, q.option_d,
         q.correct_option, q.explanation, q.explanation_reviewed]
      );
      count++;
    }
    console.log(`  ✓ ${count} sample questions seeded`);

    console.log('\n✅ Seed complete! Run generate-explanations to fill remaining explanations.\n');
  } catch (err: any) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
