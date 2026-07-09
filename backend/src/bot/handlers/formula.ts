// src/bot/handlers/formula.ts — Quick-access formula & constant reference sheets

const SHEETS: Record<string, { title: string; content: string }> = {
  physics: {
    title: '⚛️ Physics Formulas',
    content: `<b>⚛️ Physics — Key Formulas</b>

<b>Motion</b>
v = u + at
s = ut + ½at²
v² = u² + 2as
s = ½(u + v)t
Projectile: R = u²sin2θ / g,  H = u²sin²θ / 2g

<b>Momentum &amp; Impulse</b>
p = mv
Impulse = FΔt = Δp
Conservation: m₁u₁ + m₂u₂ = m₁v₁ + m₂v₂
Elastic collision: KE conserved  |  Inelastic: KE not conserved

<b>Circular Motion &amp; SHM</b>
ω = 2π/T = 2πf
F = mv²/r = mω²r  (centripetal force)
SHM: a = −ω²x
Simple pendulum: T = 2π√(l/g)
Spring: T = 2π√(m/k)

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

<b>Magnetism &amp; Electromagnetism</b>
F = BIL·sinθ  (force on current-carrying conductor)
EMF: ε = −ΔΦ/Δt  (Faraday's law)
Transformer: Vp/Vs = Np/Ns = Is/Ip

<b>Heat &amp; Thermal Physics</b>
Q = mcΔT  (specific heat capacity)
Q = mL  (latent heat, fusion/vaporisation)
Linear expansion: ΔL = LαΔT

<b>Light &amp; Optics</b>
Mirror/lens: 1/f = 1/u + 1/v
Magnification: m = v/u = hᵢ/hₒ
Refractive index: n = sin i / sin r = c/v
Power of a lens: P = 1/f  (f in metres, P in dioptres)

<b>Pressure &amp; Fluids</b>
P = F/A
P = ρgh
Archimedes: U = ρVg

<b>Modern Physics</b>
Photoelectric effect: hf = KE_max + W₀  (W₀ = work function)
Radioactive decay: N = N₀e^(−λt)
Half-life: t½ = ln2 / λ

<b>Constants</b>
g = 10 m/s²
c = 3 × 10⁸ m/s
e = 1.6 × 10⁻¹⁹ C
h = 6.63 × 10⁻³⁴ J·s
N_A = 6.02 × 10²³ mol⁻¹
G = 6.67 × 10⁻¹¹ Nm²/kg²`,
  },

  chemistry: {
    title: '🧪 Chemistry Formulas',
    content: `<b>🧪 Chemistry — Key Formulas</b>

<b>Atomic Structure</b>
Mass number (A) = protons + neutrons
Atomic number (Z) = protons = electrons (neutral atom)
Isotopes: same Z, different A (different neutron count)
Electron shells: 2, 8, 8, 18 …  (K, L, M, N)

<b>Bonding</b>
Ionic: electron transfer, metal + non-metal
Covalent: electron sharing, non-metal + non-metal
Metallic: sea of delocalised electrons
Dative (coordinate): one atom donates both electrons

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

<b>Organic Chemistry</b>
Alkanes: CₙH₂ₙ₊₂ (single bonds)
Alkenes: CₙH₂ₙ (one double bond)
Alkynes: CₙH₂ₙ₋₂ (one triple bond)
Functional groups: −OH (alcohol), −COOH (carboxylic acid), −CHO (aldehyde), &gt;C=O (ketone)
Naming roots: meth-(1C), eth-(2C), prop-(3C), but-(4C), pent-(5C)
Isomerism: same molecular formula, different structure

<b>Kinetics</b>
Rate = Δ[concentration] / Δt
Rate increases with: ↑temperature, ↑concentration, ↑surface area, catalyst
Catalyst: speeds up a reaction, chemically unchanged at the end

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
Endothermic: ΔH &gt; 0
Exothermic: ΔH &lt; 0`,
  },

  maths: {
    title: '📐 Mathematics Formulas',
    content: `<b>📐 Mathematics — Key Formulas</b>

<b>Number &amp; Numeration</b>
Surds: √a·√b = √(ab),  a/√b = a√b/b  (rationalising)
Number base to base 10: e.g. 101₂ = 1×2² + 0×2¹ + 1×2⁰

<b>Sets</b>
n(A∪B) = n(A) + n(B) − n(A∩B)
De Morgan: (A∪B)′ = A′∩B′,  (A∩B)′ = A′∪B′

<b>Algebra &amp; Sequences</b>
Quadratic: x = (−b ± √(b²−4ac)) / 2a
Sum of AP: S_n = n/2 (2a + (n−1)d)
nth term AP: T_n = a + (n−1)d
Sum of GP: S_n = a(rⁿ−1)/(r−1)
Sum to ∞ GP: S = a/(1−r)  (|r| &lt; 1)

<b>Indices &amp; Logs</b>
logₐ(xy) = logₐx + logₐy
logₐ(x/y) = logₐx − logₐy
logₐ(xⁿ) = n·logₐx
log base change: logₐx = log x / log a

<b>Probability &amp; Combinatorics</b>
P(A) = n(A) / n(S)
P(A∪B) = P(A) + P(B) − P(A∩B)
Independent events: P(A∩B) = P(A)·P(B)
Permutation: ⁿPᵣ = n! / (n−r)!
Combination: ⁿCᵣ = n! / (r!(n−r)!)

<b>Commercial Arithmetic</b>
Simple Interest: I = PRT/100
Compound Amount: A = P(1 + R/100)ⁿ
Profit % = (Profit/CP) × 100
Depreciation: V = P(1 − R/100)ⁿ

<b>Geometry &amp; Mensuration</b>
Circle: A = πr², C = 2πr
Sphere: V = 4/3 πr³, SA = 4πr²
Cylinder: V = πr²h, SA = 2πr(r+h)
Cone: V = 1/3 πr²h, l = √(r²+h²)
Pyramid: V = 1/3 × base area × h
Frustum: V = 1/3 πh(R² + Rr + r²)
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

<b>Vectors &amp; Matrices (core)</b>
Vector magnitude: |a| = √(x² + y²)
Vector addition: (a₁,a₂) + (b₁,b₂) = (a₁+b₁, a₂+b₂)
2×2 Matrix: det A = ad − bc  (A = [[a,b],[c,d]])

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

<b>Nutrition</b>
Autotrophic: makes its own food (e.g. green plants)
Heterotrophic: feeds on other organisms
Digestion path: mouth → oesophagus → stomach → small intestine → large intestine
Food tests: Benedict's = reducing sugar (brick-red) · Iodine = starch (blue-black) · Biuret = protein (purple)

<b>Excretion</b>
Kidney: filters blood, produces urine
Nephron: functional unit of the kidney
Osmoregulation: kidney controls water &amp; salt balance in blood

<b>Ecology</b>
Food chain: producer → primary consumer → secondary consumer → tertiary consumer
Energy flow: ~10% of energy passes to the next trophic level (rest lost as heat)
Ecological succession: pioneer species → intermediate stages → climax community
Biotic factors: living (competition, predation) · Abiotic: non-living (temperature, light, water)

<b>Reproduction</b>
Asexual: one parent, offspring genetically identical (e.g. binary fission, budding)
Sexual: two parents, gametes fuse at fertilisation, offspring genetically varied
Plants: pollination (self or cross) → fertilisation → seed/fruit formation

<b>Classification</b>
Kingdom → Phylum → Class → Order → Family → Genus → Species
Mnemonic: <i>King Philip Came Over For Good Soup</i>`,
  },

  economics: {
    title: '💹 Economics Key Facts',
    content: `<b>💹 Economics — Key Concepts</b>

<b>Demand &amp; Supply</b>
Law of Demand: price↑ → quantity demanded↓
Law of Supply: price↑ → quantity supplied↑
Equilibrium: Qd = Qs (market clears)
PED = % change Qd / % change P
PES = % change Qs / % change P
PED &gt; 1 → elastic  |  PED &lt; 1 → inelastic

<b>National Income</b>
GDP = C + I + G + (X − M)
GNP = GDP + Net factor income from abroad
NNP = GNP − Depreciation
Real GDP = Nominal GDP / Price Level × 100

<b>Cost &amp; Revenue</b>
TC = FC + VC
MC = ΔTC / ΔQ
TR = P × Q
Profit = TR − TC
AR = TR / Q = P  (under perfect competition)
MR = ΔTR / ΔQ

<b>Market Structures</b>
Perfect competition: many sellers, identical goods, price taker
Monopoly: single seller, price maker, barriers to entry
Oligopoly: few large firms, interdependence
Monopolistic competition: many firms, differentiated products

<b>Money &amp; Banking</b>
MV = PT  (Fisher's Quantity Theory)
Money multiplier = 1 / Cash Reserve Ratio
Inflation: too much money chasing too few goods
Deflation: sustained fall in general price level

<b>International Trade</b>
Comparative advantage: trade based on lower opportunity cost
Balance of Trade = Value of exports − Value of imports
Balance of Payments = Balance of Trade + Invisible trade + Capital flows
Terms of Trade = (Export price index / Import price index) × 100

<b>Public Finance</b>
Government revenue: taxation, fees, loans, grants
Direct tax: paid directly by the individual/firm (e.g. income tax)
Indirect tax: paid via goods/services (e.g. VAT)
Budget deficit: expenditure &gt; revenue  |  Budget surplus: revenue &gt; expenditure

<b>Population</b>
Malthusian theory: population grows geometrically, food supply only arithmetically
Population density = Total population / Land area
Demographic transition: high birth &amp; death rates → low birth &amp; death rates over time

<b>Agricultural Economics</b>
Subsistence farming: small-scale, for family consumption
Commercial farming: large-scale, for sale and profit
Factors of production: Land, Labour, Capital, Entrepreneur`,
  },

  government: {
    title: '🏛️ Government Key Facts',
    content: `<b>🏛️ Government — Key Concepts</b>

<b>Arms of Government</b>
Legislature: makes laws (NASS — Senate + HOR)
Executive: implements laws (President, Ministers)
Judiciary: interprets laws (Supreme Court)
Doctrine of Separation of Powers — Montesquieu
Checks &amp; Balances: each arm limits the others

<b>Nigerian Constitution</b>
1999 Constitution (as amended) — supreme law
Federal system: FG + 36 states + 774 LGAs
Presidential system: executive separate from legislature
Chapter II: Fundamental Objectives (non-justiciable)
Chapter IV: Fundamental Human Rights (justiciable)

<b>Political Concepts</b>
Democracy: government of, by, and for the people
Federalism: power shared between central &amp; states
Sovereignty: supreme and absolute power of a state
Citizenship: legal membership of a state
Separation of powers: prevents concentration of power

<b>Electoral Process</b>
INEC: Independent National Electoral Commission
Franchise: right to vote (18+ in Nigeria)
Proportional Representation vs First Past the Post
Political parties: mobilise voters, form government

<b>International Relations</b>
ECOWAS: Economic Community of West African States (1975)
AU: African Union (2002, replaced OAU)
UN: United Nations — 193 member states
Commonwealth: voluntary association of former British territories`,
  },

  english: {
    title: '📖 English Language Key Facts',
    content: `<b>📖 English Language — Key Facts</b>

<b>Comprehension</b>
Read the passage twice before answering
Answer strictly from the passage; don't import outside knowledge
Answer in your own words unless asked to quote directly

<b>Summary</b>
State the exact number of points asked for, no more, no less
One point per sentence, in your own words
Copied sentences from the passage score zero

<b>Lexis &amp; Structure</b>
Synonym: word with similar meaning  |  Antonym: word with opposite meaning
Concord: subject and verb must agree in number
Common traps: countable vs uncountable nouns, tense consistency

<b>Oral English</b>
Vowel sounds: /iː/ /ɪ/ /e/ /æ/ /ɑː/ /ɒ/ /ɔː/ /ʊ/ /uː/ /ʌ/ /ɜː/ /ə/
Stress: which syllable is emphasised in a word
Rhyme: words that share the same final sound

<b>Essay Writing</b>
Structure: introduction → 3–4 body paragraphs → conclusion
Types: narrative, descriptive, argumentative, expository, formal/informal letter

<b>Cloze Test</b>
Read the whole passage first to grasp context before filling gaps
Each blank tests one specific word: grammar, collocation, or meaning`,
  },

  geography: {
    title: '🌍 Geography Key Facts',
    content: `<b>🌍 Geography — Key Facts</b>

<b>Map Reading</b>
Scale: ratio of map distance to actual ground distance (e.g. 1:50,000)
Contour lines: join points of equal height; closer lines = steeper slope
Bearing: measured clockwise from North, in degrees (0°–360°)

<b>Weather &amp; Climate</b>
Weather: day-to-day atmospheric condition  |  Climate: average weather over a long period
Rainfall types: convectional, orographic (relief), frontal
Instruments: rain gauge (rainfall), barometer (pressure), thermometer (temperature)

<b>Landforms</b>
Erosion agents: rivers, wind, sea waves, glaciers
River course: youthful (V-shaped valley) → mature (meanders) → old age (flood plain, delta)
Weathering: physical (mechanical breakdown) vs chemical (decomposition)

<b>Population</b>
Population density = Total population / Land area
Factors affecting distribution: climate, relief, soil fertility, water availability

<b>Agriculture &amp; Industry</b>
Subsistence vs commercial farming
Mining: extraction of minerals (e.g. Nigeria's crude oil, tin, coal)
Industrial location factors: raw materials, power, market, labour, transport

<b>Transportation</b>
Modes: road, rail, water, air, pipeline
Factors affecting the network: relief, cost, demand`,
  },

  literature: {
    title: '📚 Literature in English Key Facts',
    content: `<b>📚 Literature in English — Key Facts</b>

<b>Genres</b>
Drama: literature for performance (dialogue, stage directions)
Poetry: uses rhythm, rhyme, and imagery to express ideas
Prose: written in ordinary language (novels, short stories)

<b>Literary Devices</b>
Simile: comparison using "like" or "as"
Metaphor: direct comparison without "like/as"
Personification: giving human qualities to non-human things
Irony: contrast between expectation and reality
Symbolism: an object or idea representing something beyond itself

<b>Elements of Drama</b>
Plot, Character, Setting, Theme, Dialogue, Conflict

<b>Elements of Poetry</b>
Stanza: a group of lines  |  Rhyme scheme: pattern of rhyming lines (e.g. ABAB)
Tone: the poet's attitude to the subject
Persona: the "voice" speaking in the poem (not always the poet)

<b>Approach to Set Texts</b>
Know: plot summary, main characters and their roles, central themes, and 2–3 quotable lines per theme`,
  },

  accounts: {
    title: '📊 Financial Accounting Formulas',
    content: `<b>📊 Financial Accounting — Key Formulas</b>

<b>Accounting Equation</b>
Assets = Liabilities + Capital (Owner's Equity)

<b>Ledger &amp; Trial Balance</b>
Double entry: every debit has a matching credit
Trial balance: list of all ledger balances; total debits = total credits

<b>Final Accounts</b>
Cost of Goods Sold = Opening Stock + Purchases − Closing Stock
Gross Profit = Net Sales − Cost of Goods Sold
Net Profit = Gross Profit + Other Income − Expenses

<b>Depreciation</b>
Straight line: Depreciation = (Cost − Residual Value) / Useful Life
Reducing balance: Depreciation = Book Value × Rate %

<b>Bank Reconciliation</b>
Adjusted Cash Book Balance = Cash Book Balance ± unrecorded items (bank charges, standing orders, direct deposits)

<b>Partnership Accounts</b>
Profit/loss shared per the partnership agreement (or equally if none exists)
Interest on capital and drawings adjusted before the final profit share`,
  },

  agric: {
    title: '🌱 Agricultural Science Key Facts',
    content: `<b>🌱 Agricultural Science — Key Facts</b>

<b>Crop Science</b>
Crop classes: cereals, legumes, tubers, fruits, vegetables
Propagation: seeds (sexual) vs cuttings/budding/grafting (vegetative/asexual)

<b>Soil Science</b>
Soil types: sandy, clay, loamy, silty
Loamy soil is best for most crops — balanced sand/silt/clay, good drainage &amp; nutrients
Soil pH: below 7 = acidic, 7 = neutral, above 7 = alkaline

<b>Animal Production</b>
Monogastric animals: one-chambered stomach (e.g. poultry, pigs)
Ruminants: multi-chambered stomach (e.g. cattle, goats, sheep)
Incubation period (chicken egg): ~21 days

<b>Pest &amp; Disease Control</b>
Methods: cultural, biological, chemical, mechanical
Biological control: using a natural enemy to control a pest

<b>Farm Management &amp; Economics</b>
Factors of production: Land, Labour, Capital, Management
Farm records track income, expenditure, and productivity`,
  },

  commerce: {
    title: '🏪 Commerce Key Facts',
    content: `<b>🏪 Commerce — Key Facts</b>

<b>Trade</b>
Home trade: buying and selling within a country (retail + wholesale)
Foreign trade: import, export, and entrepôt trade between countries
Aids to trade: transport, banking, insurance, warehousing, advertising, communication

<b>Business Organisation</b>
Sole proprietorship: one owner, unlimited liability
Partnership: 2+ owners, shared capital and liability
Company: separate legal entity, limited liability, owned by shareholders

<b>Insurance</b>
Principle: spreading risk among many people (the insured pool)
Premium: amount paid by the insured  |  Policy: the insurance contract
Types: life, fire, marine, motor insurance

<b>Banking</b>
Central Bank of Nigeria (CBN): regulates money supply and commercial banks
Commercial bank functions: accepting deposits, giving loans, money transfer

<b>Warehousing &amp; Transport</b>
Warehousing: storage of goods before sale or distribution
Transport modes: road, rail, water, air, pipeline`,
  },

  computer: {
    title: '💻 Computer Studies Key Facts',
    content: `<b>💻 Computer Studies — Key Facts</b>

<b>Hardware &amp; Software</b>
Hardware: physical parts of a computer (CPU, monitor, keyboard, mouse)
Software: programs that run on a computer — system software vs application software
CPU parts: Control Unit, Arithmetic &amp; Logic Unit (ALU), Registers

<b>Data Processing</b>
Data: raw, unprocessed facts  |  Information: processed, meaningful data
Data processing cycle: Input → Process → Output → Storage

<b>Number Systems</b>
Binary (base 2): uses only 0 and 1
Binary to decimal: e.g. 101₂ = 1×2² + 0×2¹ + 1×2⁰ = 5₁₀

<b>Operating Systems &amp; Networking</b>
OS functions: manages hardware, runs programs, manages files
LAN: Local Area Network (small area, e.g. one building)
WAN: Wide Area Network (large area, e.g. across cities/countries)

<b>Database &amp; Spreadsheets</b>
Database: organised collection of related data
Spreadsheet: grid of rows &amp; columns for calculations (e.g. Excel)
Common spreadsheet functions: SUM, AVERAGE, MAX, MIN`,
  },

  crk: {
    title: '✝️ CRK Key Facts',
    content: `<b>✝️ Christian Religious Knowledge — Key Facts</b>

<b>Old Testament</b>
Pentateuch: first 5 books (Genesis, Exodus, Leviticus, Numbers, Deuteronomy)
Key figures: Abraham, Moses, David, Solomon, the Prophets
Ten Commandments: given to Moses on Mount Sinai (Exodus 20)

<b>New Testament</b>
Gospels: Matthew, Mark, Luke, John — record the life of Jesus Christ
Acts of the Apostles: spread of the early church after Jesus' ascension
Epistles: letters written by apostles (e.g. Paul) to early churches

<b>Christian Living &amp; Ethics</b>
The Beatitudes: Jesus' teachings on blessedness (Matthew 5)
Fruit of the Spirit: love, joy, peace, patience, kindness, goodness, faithfulness, gentleness, self-control (Galatians 5)
The Golden Rule: treat others as you would want to be treated

<b>Church History</b>
Pentecost: the Holy Spirit descends on the apostles (Acts 2) — marks the birth of the church
Early church growth spread through Judea, Samaria, and beyond

<b>Approach to Set Texts</b>
Know the reference (book, chapter, verse), the context, and the moral/theological lesson of each key passage`,
  },

  irk: {
    title: '☪️ IRK Key Facts',
    content: `<b>☪️ Islamic Religious Knowledge — Key Facts</b>

<b>Qur'an</b>
Revealed to Prophet Muhammad (SAW) over 23 years
114 Surahs (chapters), arranged roughly longest to shortest, not chronologically
First revelation: Surah Al-Alaq

<b>Hadith</b>
Sayings, actions, and approvals of Prophet Muhammad (SAW)
Second source of Islamic law after the Qur'an
Key collections: Sahih Bukhari, Sahih Muslim

<b>Pillars of Islam</b>
1. Shahada (declaration of faith)
2. Salat (five daily prayers)
3. Zakat (obligatory charity)
4. Sawm (fasting in Ramadan)
5. Hajj (pilgrimage to Mecca, if able)

<b>Islamic History</b>
Hijrah: Prophet Muhammad's migration from Mecca to Medina (622 CE) — marks year 1 of the Islamic calendar
The four Rightly Guided Caliphs: Abu Bakr, Umar, Uthman, Ali

<b>Islamic Jurisprudence &amp; Ethics</b>
Sources of Shari'ah: Qur'an, Hadith, Ijma (consensus), Qiyas (analogy)
Halal: permissible  |  Haram: forbidden`,
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
    [
      { text: '🧬 Biology', callback_data: 'formula:biology' },
      { text: '💹 Economics', callback_data: 'formula:economics' },
    ],
    [
      { text: '🏛️ Government', callback_data: 'formula:government' },
      { text: '📖 English', callback_data: 'formula:english' },
    ],
    [
      { text: '🌍 Geography', callback_data: 'formula:geography' },
      { text: '📚 Literature', callback_data: 'formula:literature' },
    ],
    [
      { text: '📊 Accounts', callback_data: 'formula:accounts' },
      { text: '🌱 Agric', callback_data: 'formula:agric' },
    ],
    [
      { text: '🏪 Commerce', callback_data: 'formula:commerce' },
      { text: '💻 Computer', callback_data: 'formula:computer' },
    ],
    [
      { text: '✝️ CRK', callback_data: 'formula:crk' },
      { text: '☪️ IRK', callback_data: 'formula:irk' },
    ],
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
  const sheet = SHEETS[subject];
  if (!sheet) {
    await ctx.answerCbQuery('Subject not found.', { show_alert: true });
    return;
  }
  await ctx.answerCbQuery();
  await ctx.reply(sheet.content, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '« Back to Subjects', callback_data: 'formula:pick' }],
      ],
    },
  });
}
