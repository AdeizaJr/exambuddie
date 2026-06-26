// src/bot/handlers/formula.ts — Quick-access formula & constant reference sheets
import * as db from '../../db';

const SHEETS: Record<string, { title: string; content: string }> = {
  physics: {
    title: '⚛️ Physics Formulas',
    content: `<b>⚛️ Physics — Key Formulas</b>

<b>Motion</b>
v = u + at
s = ut + ½at²
v² = u² + 2as
s = ½(u + v)t

<b>Forces &amp; Energy</b>
F = ma
W = mg  (g ≈ 10 m/s²)
KE = ½mv²
PE = mgh
W = Fd·cosθ
P = W/t = Fv

<b>Waves</b>
v = fλ
T = 1/f
n = sin i / sin r  (Snell's law)

<b>Electricity</b>
V = IR  (Ohm's law)
P = IV = I²R = V²/R
Q = It
E = Pt
Series: R_total = R₁ + R₂ + …
Parallel: 1/R = 1/R₁ + 1/R₂ + …

<b>Pressure &amp; Fluids</b>
P = F/A
P = ρgh
Archimedes: U = ρVg

<b>Constants</b>
g = 10 m/s²
c = 3 × 10⁸ m/s
e = 1.6 × 10⁻¹⁹ C
h = 6.63 × 10⁻³⁴ J·s
N_A = 6.02 × 10²³ mol⁻¹`,
  },

  chemistry: {
    title: '🧪 Chemistry Formulas',
    content: `<b>🧪 Chemistry — Key Formulas</b>

<b>Mole Calculations</b>
n = m / M  (moles = mass / molar mass)
n = V / 22.4  (at STP, gas)
n = CV  (concentration × volume)
%purity = (actual/theoretical) × 100

<b>Gas Laws</b>
PV = nRT  (R = 8.314 J/mol·K)
Boyle: P₁V₁ = P₂V₂  (T constant)
Charles: V₁/T₁ = V₂/T₂  (P constant)
Combined: P₁V₁/T₁ = P₂V₂/T₂

<b>Electrochemistry</b>
E = Q / (nF)  (Faraday's law)
F = 96500 C/mol
m = (M × I × t) / (n × F)

<b>Equilibrium</b>
K_c = [products] / [reactants]
pH = −log[H⁺]
pOH = −log[OH⁻]
pH + pOH = 14
[H⁺][OH⁻] = 10⁻¹⁴

<b>Concentration</b>
C = n / V  (mol/dm³)
Dilution: C₁V₁ = C₂V₂

<b>Energy</b>
ΔH = H(products) − H(reactants)
Endothermic: ΔH > 0
Exothermic: ΔH < 0`,
  },

  maths: {
    title: '📐 Mathematics Formulas',
    content: `<b>📐 Mathematics — Key Formulas</b>

<b>Algebra</b>
Quadratic: x = (−b ± √(b²−4ac)) / 2a
Sum of AP: S_n = n/2 (2a + (n−1)d)
nth term AP: T_n = a + (n−1)d
Sum of GP: S_n = a(rⁿ−1)/(r−1)
Sum to ∞ GP: S = a/(1−r)  |r| &lt; 1

<b>Indices &amp; Logs</b>
logₐ(xy) = logₐx + logₐy
logₐ(x/y) = logₐx − logₐy
logₐ(xⁿ) = n·logₐx
log base change: logₐx = log x / log a

<b>Geometry</b>
Circle: A = πr², C = 2πr
Sphere: V = 4/3 πr³, SA = 4πr²
Cylinder: V = πr²h, SA = 2πr(r+h)
Cone: V = 1/3 πr²h, l = √(r²+h²)
Triangle: A = ½bh = ½ab·sin C

<b>Trigonometry</b>
sin²θ + cos²θ = 1
1 + tan²θ = sec²θ
Sine rule: a/sinA = b/sinB = c/sinC
Cosine rule: a² = b² + c² − 2bc·cosA

<b>Coordinate Geometry</b>
Distance: d = √((x₂−x₁)² + (y₂−y₁)²)
Midpoint: ((x₁+x₂)/2, (y₁+y₂)/2)
Gradient: m = (y₂−y₁)/(x₂−x₁)

<b>Statistics</b>
Mean = Σx / n
Variance = Σ(x−x̄)² / n
SD = √Variance`,
  },

  'further-math': {
    title: '📐 Further Mathematics',
    content: `<b>📐 Further Mathematics — Key Formulas</b>

<b>Calculus — Differentiation</b>
d/dx(xⁿ) = nxⁿ⁻¹
d/dx(sin x) = cos x
d/dx(cos x) = −sin x
d/dx(eˣ) = eˣ
d/dx(ln x) = 1/x
Product rule: (uv)' = u'v + uv'
Chain rule: d/dx[f(g(x))] = f'(g(x))·g'(x)

<b>Calculus — Integration</b>
∫xⁿ dx = xⁿ⁺¹/(n+1) + C  (n ≠ −1)
∫sin x dx = −cos x + C
∫cos x dx = sin x + C
∫eˣ dx = eˣ + C
∫1/x dx = ln|x| + C

<b>Vectors</b>
|a| = √(a₁² + a₂² + a₃²)
a·b = |a||b|cosθ
a × b → magnitude = |a||b|sinθ

<b>Complex Numbers</b>
i² = −1
z = a + bi,  |z| = √(a²+b²)
z̄ = a − bi
Modulus-argument: z = r(cosθ + i sinθ)

<b>Binomial Theorem</b>
(a+b)ⁿ = Σ C(n,r) aⁿ⁻ʳ bʳ
C(n,r) = n! / (r!(n−r)!)

<b>Matrices (2×2)</b>
det A = ad − bc
A⁻¹ = 1/det · [[d,−b],[−c,a]]`,
  },

  biology: {
    title: '🧬 Biology Key Facts',
    content: `<b>🧬 Biology — Key Facts &amp; Formulas</b>

<b>Cell Biology</b>
Prokaryotes: no membrane-bound nucleus
Eukaryotes: membrane-bound nucleus
Osmosis: water moves from low → high solute
Diffusion: high → low concentration (passive)
Active transport: low → high (needs ATP)

<b>Genetics</b>
Mendel's 1st Law: Law of Segregation
Mendel's 2nd Law: Independent Assortment
Monohybrid ratio: 3:1 (Rr × Rr)
Dihybrid ratio: 9:3:3:1
Codominance: both alleles expressed equally
Incomplete dominance: blended phenotype

<b>Photosynthesis</b>
6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂
Light reaction: produces ATP + NADPH
Dark reaction (Calvin cycle): fixes CO₂

<b>Respiration</b>
Aerobic: C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + 38 ATP
Anaerobic (yeast): glucose → ethanol + CO₂ + 2 ATP
Anaerobic (muscle): glucose → lactic acid + 2 ATP

<b>Classification</b>
Kingdom → Phylum → Class → Order → Family → Genus → Species
Mnemonic: <i>King Philip Came Over For Good Soup</i>`,
  },
};

const SUBJECT_KEYBOARD = {
  inline_keyboard: [
    [
      { text: '⚛️ Physics', callback_data: 'formula:physics' },
      { text: '🧪 Chemistry', callback_data: 'formula:chemistry' },
    ],
    [
      { text: '📐 Maths', callback_data: 'formula:maths' },
      { text: '📐 Further Maths', callback_data: 'formula:further-math' },
    ],
    [{ text: '🧬 Biology', callback_data: 'formula:biology' }],
  ],
};

export async function handleFormula(ctx: any): Promise<void> {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  await ctx.reply(
    '📐 <b>Formula Sheets</b>\n\nChoose a subject:',
    { parse_mode: 'HTML', reply_markup: SUBJECT_KEYBOARD }
  );
}

export async function handleFormulaSubject(ctx: any, subject: string): Promise<void> {
  await ctx.answerCbQuery();
  const sheet = SHEETS[subject];
  if (!sheet) {
    await ctx.answerCbQuery('Subject not found.', { show_alert: true });
    return;
  }
  await ctx.reply(sheet.content, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '« Back to Subjects', callback_data: 'formula:pick' }],
      ],
    },
  });
}
