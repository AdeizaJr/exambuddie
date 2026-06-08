// scripts/classifyTopics.ts
// Rule-based topic classifier for WAEC/NECO/JAMB questions.
// Uses keyword patterns per subject to assign topics without an API key.
// Safe to re-run — only updates rows where topic IS NULL or empty.
//
// Usage:  npx ts-node scripts/classifyTopics.ts

import dotenv from 'dotenv';
dotenv.config();
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

type Rule = [RegExp, string]; // [pattern, topic]

// ── Topic rule tables ────────────────────────────────────────────────────────
// Rules are checked in order — first match wins.

const RULES: Record<string, Rule[]> = {

  english: [
    [/vowel sound|consonant sound|underlined letter|letter\(s\) underlined|stress pattern|intonation|phoneme|syllable|rhyme|diphthong|nasal|fricative|plosive/i, 'Oral English'],
    [/nearest in meaning|opposite in meaning|synonym|antonym|underlined word|choose the option.*meaning/i, 'Lexis & Structure'],
    [/fill (the |in the )?gap|complete.*(sentence|passage)|blank|appropriate word/i, 'Lexis & Structure'],
    [/comprehension|passage|paragraph|according to (the |this )?passage|author|text says|from the (above )?passage/i, 'Comprehension'],
    [/summary|summarize|main (idea|point)|central (idea|theme)/i, 'Summary Writing'],
    [/tense|verb|noun|pronoun|adjective|adverb|preposition|conjunction|article|clause|phrase|sentence structure|part of speech|plural|singular|subject.*predicate|passive|active voice|reported speech|punctuation|comma|apostrophe|hyphen/i, 'Grammar'],
    [/figure of speech|metaphor|simile|personification|oxymoron|paradox|irony|euphemism|alliteration|imagery|tone|mood|diction|literary (device|technique)/i, 'Literary Devices'],
    [/letter writing|formal letter|informal letter|memo|report writing|speech|essay|composition/i, 'Writing Skills'],
  ],

  math: [
    [/\bset(s)?\b|union|intersection|complement|subset|universal set|venn diagram/i, 'Sets'],
    [/logarithm|log\b|antilog|index laws|law of indices|\^n|\bsurd|irrational/i, 'Indices & Logarithms'],
    [/number base|binary|octal|hexadecimal|base (2|8|10|16)|convert.*base|denary/i, 'Number Bases'],
    [/fraction|decimal|percentage|ratio|proportion|rate|approximat|significant figure|standard form|nearest (whole|tenth|hundredth)/i, 'Fractions & Decimals'],
    [/arithmetic progression|\bAP\b|geometric progression|\bGP\b|common difference|common ratio|sum to infinity|nth term|sequence|series/i, 'Sequences & Series'],
    [/matrix|matrices|determinant|transpose|inverse of a matrix|2x2|3x3/i, 'Matrices'],
    [/vector|position vector|resultant|magnitude|direction|scalar/i, 'Vectors'],
    [/differentiat|derivative|dy\/dx|d\/dx|rate of change|gradient of.*curve|turning point|maximum.*minimum|calculus/i, 'Differentiation'],
    [/integrat|∫|∫\(|integral|area under.*curve|volume of revolution/i, 'Integration'],
    [/coordinate|gradient|midpoint|distance between|equation of (the )?line|straight line|slope|locus|circle equation|x.*intercept|y.*intercept/i, 'Coordinate Geometry'],
    [/bearing|angle of elevation|angle of depression|sine rule|cosine rule|\bsin\b|\bcos\b|\btan\b|trigonometr|complementary angle|supplementary/i, 'Trigonometry'],
    [/probability|event|outcome|sample space|mutually exclusive|independent event|tree diagram|permutation|combination|\bP\(.*\)|\bC\(/i, 'Probability'],
    [/mean|median|mode|range|variance|standard deviation|frequency (table|distribution)|histogram|cumulative frequency|pie chart|bar chart|data|ogive/i, 'Statistics'],
    [/area|volume|perimeter|surface area|circumference|cylinder|sphere|cone|prism|pyramid|mensuration|sector|arc length|total surface/i, 'Mensuration'],
    [/angle|triangle|polygon|parallel|perpendicular|quadrilateral|rhombus|trapezium|parallelogram|rectangle|square|circle|chord|tangent|arc|sector|proof|congruent|similar/i, 'Geometry'],
    [/quadratic|factori|expand|simplify|expression|polynomial|remainder theorem|factor theorem|algebraic fraction|algebraic manipulation/i, 'Algebra'],
    [/equation|inequality|simultaneous|linear|variable|unknown|solve for|find.*value of [a-z]|variation|varies (directly|inversely)/i, 'Algebra'],
  ],

  'further-math': [
    [/complex number|argand|imaginary|real part|modulus|argument|de moivre|z =|purely imaginary/i, 'Complex Numbers'],
    [/differential equation|d²y|d2y|second order|particular solution|general solution.*differential/i, 'Differential Equations'],
    [/differentiat|derivative|dy\/dx|d\/dx|rate of change|turning point|maximum.*minimum|stationary point|f'\(x\)|second derivative|implicit|parametric differentiation/i, 'Differentiation'],
    [/integrat|∫|integral|area under|volume of revolution|antiderivative|indefinite|definite integral/i, 'Integration'],
    [/matrix|matrices|determinant|transpose|eigenvalue|inverse.*matrix|singular|transformation/i, 'Matrices & Transformations'],
    [/vector|position vector|scalar product|dot product|cross product|unit vector|perpendicular.*vector/i, 'Vectors'],
    [/probability|binomial distribution|normal distribution|poisson|variance|standard deviation|cumulative|P\(X|expected value|random variable/i, 'Statistics & Probability'],
    [/arithmetic progression|geometric progression|binomial theorem|expansion|series|sequence|sum.*terms|nth term|convergent|divergent/i, 'Sequences & Series'],
    [/coordinate|conic section|parabola|ellipse|hyperbola|locus|focus|directrix|asymptote/i, 'Coordinate Geometry'],
    [/\bsin\b|\bcos\b|\btan\b|trigonometr|identities|addition formula|double angle|half angle|compound angle|sec|cosec|cot|inverse trig/i, 'Trigonometry'],
    [/inequality|linear programming|feasible region|objective function|constraint/i, 'Linear Programming'],
    [/root|polynomial|remainder|factor theorem|equation.*degree|quadratic.*further|cubic equation/i, 'Polynomials & Equations'],
    [/set|group theory|function.*mapping|bijection|surjection|injection/i, 'Sets & Functions'],
    [/force|mechanics|motion|velocity|acceleration|projectile|Newton.*further|momentum.*further|equilibrium.*force/i, 'Mechanics'],
  ],

  biology: [
    [/cell (wall|membrane|organelle|division|structure|biology|theory)|nucleus|cytoplasm|mitochondria|ribosome|chloroplast|vacuole|lysosome|endoplasmic|golgi|mitosis|meiosis|cell cycle|chromosome|cell growth|level of organization|prokaryot|eukaryot|building block of/i, 'Cell Biology'],
    [/gene|allele|heredity|inheritance|Mendel|genotype|phenotype|dominant|recessive|mutation|cross.*breed|dihybrid|monohybrid|F1|F2 generation|DNA|RNA|protein synthesis|codon|transcription|translation|sex.linked|inheritable|sex chromosome|XY|XX/i, 'Genetics'],
    [/ecosystem|habitat|food (chain|web)|producer|consumer|decomposer|population|community|biome|abiotic|biotic|niche|succession|ecology|trophic|energy flow|nutrient cycle|carbon cycle|nitrogen cycle|symbiosis|mutualism|commensalism|parasitism|predation|competition|association.*organism|organism.*relationship|epiphyte|commensal|saprophyte|conservation|wildlife|endangered|biodiversity|natural resource|environment.*living|herbicide|pesticide|insecticide|pollutant|acid rain.*bio|struggle for existence/i, 'Ecology'],
    [/evolution|natural selection|adaptation|Darwin|fossil|speciation|extinct|variation|survival of the fittest|Lamarck|proposed by|concluded.*evolution/i, 'Evolution'],
    [/reproduct|fertilization|gamete|seed|pollination|germination|embryo|placenta|ovum|sperm|sexual|asexual|vegetative|budding|binary fission|spore|oviparous|viviparous|flower.*reproduce|dispersal|pollen|anther|stigma|sepal|petal|ovule|fruit.*develop|gynoeciou|monoeciou/i, 'Reproduction'],
    [/photosynthesis|chlorophyll|light reaction|dark reaction|Calvin|starch|glucose.*plant|autotroph|heterotroph.*plant|light energy.*plant/i, 'Photosynthesis'],
    [/digestion|enzyme|nutrition|vitamin|mineral|carbohydrate|protein|fat|lipid|peristalsis|alimentary|stomach|intestine|liver|pancreas|bile|amylase|pepsin|Benedict|fehling|biuret|iodine.*test|food test|reducing sugar|non-reducing|food substance|food.*test|trypsin|lactase/i, 'Nutrition & Digestion'],
    [/blood|heart|artery|vein|capillary|circulation|pulse|haemoglobin|plasma|platelet|white blood cell|red blood cell|lymph|transpiration|xylem|phloem|osmosis|diffusion|turgor|fibrinogen|prothrombin|clotting|blood vessel|alimentary canal.*liver/i, 'Transport'],
    [/respiration|ATP|aerobic|anaerobic|oxygen|breathing|lung|trachea|diaphragm|alveoli|inspiration|expiration|gaseous exchange|inhaled|exhaled|cockroach.*respiratory|respiratory organ/i, 'Respiration'],
    [/excretion|kidney|urea|uric acid|nephron|urine|liver.*excretion|skin.*excretion|dialysis|osmoregulation|sweat|sweating|muscular exercise/i, 'Excretion'],
    [/nerve|neuron|synapse|hormone|endocrine|insulin|adrenaline|reflex|brain|spinal cord|stimulus|receptor|tropism|nastic|homeostasis|feedback|sense organ|tongue.*sensitive|colour change|chameleon|pigment.*colour|immunity|vaccination|antibody|antigen|immune|HIV|AIDS|pathogen|disease.*caused|infection|malaria|tuberculosis|virus.*disease/i, 'Coordination'],
    [/bone|muscle|skeleton|joint|tendon|ligament|cartilage|exoskeleton|endoskeleton|locomotion|hydrostatic|support|movement|dentition|teeth|comb.*fowl|skeletal system/i, 'Support & Movement'],
    [/kingdom|phylum|class|order|family|genus|species|taxonomy|classification|fungi|protist|bacteria|virus|algae|moss|fern|bryophyte|pteridophyte|gymnosperm|angiosperm|invertebrate|vertebrate|mammal|reptile|amphibian|fish|bird|insect|spirogyra|chlamydomonas|paramecium|amoeba|organism.*cannot.*freely|freely on its own|scientific study of life/i, 'Classification'],
    [/soil|mineral salt|water absorption|root hair|germination.*seed|plant growth|auxin|gibberellin|cortex.*stem|herbaceous stem|xylem.*plant|phloem.*plant|vascular.*plant|mesophyll|stomata|lenticel|carnivorous plant|pests of plant/i, 'Plant Biology'],
  ],

  chemistry: [
    [/atomic number|atomic mass|isotope|electron configuration|energy level|orbital|quantum|proton|neutron|nuclear|electron.*shell|subshell|d-block|p-block|s-block|unpaired electron|N shell|maximum electron|atomic weight|most electronegative|electronegativity/i, 'Atomic Structure'],
    [/ionic bond|covalent bond|metallic bond|hydrogen bond|van der waals|bond angle|molecular shape|hybridization|sigma|pi bond|type of bond|bond.*form|crystal.*bond|ammonium.*bond|polarity|polar|non-polar|electron.*share|ionic.*covalent/i, 'Chemical Bonding'],
    [/acid|base|alkali|neutralization|pH|indicator|salt preparation|buffer|strong acid|weak acid|titration|hydrolysis|basicity|litmus|flame.*test|flame colour|identify.*compound|dibasic|tribasic|monobasic|polyprotic|H\+.*OH|ionic equation.*neutraliz/i, 'Acids, Bases & Salts'],
    [/periodic (table|law|trend)|group|period|halogen|noble gas|alkali metal|alkaline earth|transition metal|lanthanide|atomic radius|ionization energy|chemically nonreactive|neon|unreactive/i, 'Periodic Table'],
    [/organic|alkane|alkene|alkyne|aromatic|benzene|alcohol|ether|aldehyde|ketone|carboxylic|ester|amide|amine|polymer|hydrocarbon|isomerism|functional group|IUPAC|homologous|petroleum|crude oil|fraction.*refin|kerosene|bitumen|naphtha|cracking.*oil|alkanone|react.*bromine|C2H|C3H|CH3|parent chain|carbon atom.*chain|distinguish.*ethanol|ethanoic|polystyrene|packaging/i, 'Organic Chemistry'],
    [/electrolysis|electrode|anode|cathode|electrolyte|Faraday|electrochemical|galvanic|cell (voltage|potential)|standard electrode|NaCl.*conduct|conduct electricity|ionic.*conduct/i, 'Electrochemistry'],
    [/rate of reaction|catalyst|activation energy|equilibrium|Le Chatelier|Kc|Kp|reversible reaction|dynamic equilibrium|Haber|Contact process|collision theory|spontaneity|spontaneous|enhance.*reaction|reaction rate/i, 'Kinetics & Equilibrium'],
    [/\bmole\b|molar mass|empirical formula|molecular formula|stoichiometry|reacting masses|limiting reagent|percentage yield|relative molecular mass|Avogadro|how many atoms|atoms.*present|6.02|Mg = 24|moles of|percentage.*element|molecular weight/i, 'Stoichiometry & Mole'],
    [/gas law|Boyle|Charles|ideal gas|Gay-Lussac|diffusion.*gas|effusion|states of matter|vapour pressure|boiling point|melting point|sublimation|kinetic theory|fountain experiment|Graham.*law|rate of diffusion|collected.*gas|downward delivery|upward delivery|density.*gas|sieving|filtration|distillation|chromatography|separation.*mixture|mixture.*contain|type of mixture|example.*mixture|matter/i, 'States of Matter'],
    [/enthalpy|Hess|bond energy|exothermic|endothermic|heat of (combustion|formation|neutralization|solution)|calorimeter|thermochemistry|heat.*released|heat.*absorbed|energy.*change|magnesium.*oxygen|dissolve.*heat|sugar.*dissolve/i, 'Thermochemistry'],
    [/metal|ore|extraction|blast furnace|alloy|corrosion|rust|iron|copper|aluminium|sodium|calcium|zinc|oxidation state|redox|reducing agent|oxidizing agent|oxidation.*reduction|reaction.*oxygen|electro.*series|activity series/i, 'Metals & Redox'],
    [/water|hard water|soft water|temporary hardness|permanent hardness|chlorination|sewage|purification/i, 'Water Chemistry'],
    [/pollution|atmosphere|ozone|greenhouse|acid rain|environment|smog|global warming|consequence.*warming|carbon.*dioxide.*air|percentage.*air|composition.*air/i, 'Environmental Chemistry'],
    [/solution|solubility|saturated|concentration|molarity|dilution|solute|solvent|colligative|degree of purity|pure.*chemical/i, 'Solutions'],
  ],

  physics: [
    [/velocity|acceleration|displacement|distance|speed|motion|Newton.*law|momentum|impulse|force|friction|projectile|circular motion|relative motion/i, 'Mechanics'],
    [/wave|frequency|wavelength|amplitude|period|transverse|longitudinal|superposition|interference|diffraction|resonance|standing wave|stationary wave/i, 'Waves'],
    [/sound|echo|ultrasound|decibel|pitch|loudness|Doppler|acoustic/i, 'Sound'],
    [/light|reflection|refraction|lens|mirror|focal length|image|object|magnification|total internal reflection|prism|spectrum|colour|optical|eye|defect of vision/i, 'Optics'],
    [/electric(al)? (field|charge|force|current|potential)|Coulomb|capacitor|resistance|Ohm|circuit|series|parallel|ammeter|voltmeter|power|energy.*electric|Kirchhoff|EMF/i, 'Electricity'],
    [/magnet(ic|ism)|magnetic (field|flux|force)|electromagnet|Faraday|Lenz|motor|generator|transformer|induction|solenoid/i, 'Magnetism'],
    [/temperature|heat|thermal|conduction|convection|radiation|specific heat|latent heat|thermometer|expansion|gas law|Boyle|Charles|ideal gas|thermodynamics/i, 'Heat & Thermodynamics'],
    [/radioactiv|nuclear|alpha|beta|gamma|half.life|decay|fission|fusion|atomic mass|isotope|radiation.*physics|Geiger|dosimeter/i, 'Atomic & Nuclear Physics'],
    [/work|energy|power|kinetic energy|potential energy|conservation.*energy|mechanical advantage|efficiency|machine|pulley|lever|inclined plane/i, 'Work, Energy & Power'],
    [/pressure|fluid|Pascal|Archimedes|buoyancy|upthrust|density|surface tension|viscosity|Bernoulli|hydraulic/i, 'Pressure & Fluids'],
    [/measurement|unit|dimension|SI unit|significant figure|error|instrument|vernier|micrometer|metre rule/i, 'Measurement'],
    [/semiconductor|diode|transistor|rectifier|gate|logic|digital|analogue|amplifier/i, 'Electronics'],
  ],

  economics: [
    [/demand|supply|price|quantity (demanded|supplied)|law of demand|law of supply|elastic|inelastic|market equilibrium|excess (demand|supply)|price ceiling|price floor/i, 'Demand & Supply'],
    [/national income|GDP|GNP|GNI|NNP|NNI|circular flow|macroeconomics|aggregate (demand|supply)|multiplier|consumption|investment/i, 'National Income'],
    [/money|currency|barter|functions of money|money supply|inflation|deflation|monetary policy|Central Bank|commercial bank|interest rate|credit creation/i, 'Money & Banking'],
    [/international trade|export|import|balance of payment|balance of trade|exchange rate|comparative advantage|terms of trade|tariff|quota|free trade|protectionism|ECOWAS|WTO/i, 'International Trade'],
    [/production|cost|output|short run|long run|economies of scale|returns to scale|average cost|marginal cost|fixed cost|variable cost|total cost|factor of production/i, 'Production & Costs'],
    [/monopoly|oligopoly|perfect competition|monopolistic competition|market structure|price discrimination|cartel|duopoly|kinked demand/i, 'Market Structures'],
    [/tax|taxation|fiscal policy|government spending|budget|public finance|subsidy|transfer payment|incidence of tax|direct tax|indirect tax|VAT/i, 'Public Finance'],
    [/population|labour|employment|unemployment|wage|trade union|human capital|migration|census|demographic/i, 'Population & Labour'],
    [/agricultural|farming|peasant|cash crop|food crop|subsistence|irrigation|land reform|green revolution|rural/i, 'Agriculture & Development'],
    [/utility|consumer|indifference curve|budget line|consumer equilibrium|cardinal|ordinal|marginal utility|diminishing utility/i, 'Theory of Consumer Behaviour'],
    [/entrepreneur|profit|revenue|firm|business|partnership|sole proprietorship|cooperative|public corporation|privatization/i, 'Business & Enterprise'],
  ],

  government: [
    [/constitution|constitutional|fundamental right|bill of rights|amendment|federal|federalism|unitary|confederation|division of power|residual power|concurrent/i, 'Constitutionalism & Federalism'],
    [/election|electoral|voting|ballot|franchise|suffrage|INEC|election commission|constituency|proportional representation|first past the post|electoral college/i, 'Electoral Systems'],
    [/executive|president|governor|prime minister|cabinet|minister|council of state|power of the executive|separation of power/i, 'The Executive'],
    [/legislature|parliament|congress|senate|house of representative|bill|law making|legislative process|committee|speaker|reading of bill/i, 'The Legislature'],
    [/judiciary|court|judge|justice|judicial|appeal|supreme court|high court|magistrate|rule of law|independence of judiciary/i, 'The Judiciary'],
    [/political party|party system|one party|two party|multi party|party manifesto|party platform|ideology|liberalism|conservatism|socialism/i, 'Political Parties & Ideologies'],
    [/local government|local council|tier of government|grassroots|LGEA|chieftaincy|traditional ruler/i, 'Local Government'],
    [/United Nations|UN|African Union|AU|ECOWAS|Commonwealth|NATO|international organization|sovereignty|diplomacy|foreign policy|treaty|international law/i, 'International Relations'],
    [/civil society|pressure group|interest group|NGO|trade union|lobby|public opinion|political participation/i, 'Civil Society'],
    [/colonialism|colonial|independence|nationalism|decolonization|self-determination|imperialism|pre-colonial|post-colonial/i, 'Nigerian Political History'],
    [/citizenship|civic|rights|responsibilities|rule of law|democracy|dictatorship|autocracy|monarchy|republic/i, 'Citizenship & Democracy'],
  ],

  literature: [
    [/novel|prose|fiction|narrator|narrative|plot|character|setting|theme|point of view|omniscient|first.person|stream of consciousness/i, 'Prose Fiction'],
    [/poem|poetry|verse|stanza|rhyme|rhythm|meter|sonnet|ballad|ode|lyric|epic|haiku|free verse|speaker|persona/i, 'Poetry'],
    [/play|drama|playwright|act|scene|dialogue|monologue|soliloquy|tragedy|comedy|dramatic irony|stage direction|protagonist|antagonist/i, 'Drama'],
    [/figure of speech|metaphor|simile|personification|oxymoron|paradox|irony|euphemism|alliteration|assonance|imagery|symbolism|allegory|hyperbole|litotes/i, 'Literary Devices'],
    [/Achebe|Soyinka|Ngugi|Buchi|Okara|Clark|Osofisan|Aidoo|Rotimi|Armah|African literature|Nigerian literature/i, 'African Literature'],
    [/Shakespeare|Dickens|Hardy|Austen|Orwell|Hemingway|British|American literature|Victorian|Elizabethan/i, 'Non-African Literature'],
  ],

  geography: [
    [/climate|weather|temperature|rainfall|humidity|wind|pressure|atmospheric|insolation|season|monsoon|tropical|savanna|desert|equatorial/i, 'Climate & Weather'],
    [/population|census|density|distribution|migration|urbanization|rural|urban|birth rate|death rate|demographic|settlement|city/i, 'Population & Settlement'],
    [/agriculture|farming|crop|livestock|irrigation|soil|fertilizer|cash crop|food crop|plantation|pastoral|arable/i, 'Agriculture'],
    [/mineral|mining|ore|petroleum|coal|iron|gold|diamond|quarrying|natural resource|extraction/i, 'Mining & Resources'],
    [/industry|manufacturing|industrialization|factory|cottage industry|heavy industry|light industry|industrial location/i, 'Industry'],
    [/transport|road|railway|waterway|air transport|port|harbor|trade route|communication/i, 'Transport & Trade'],
    [/rock|mineral formation|igneous|sedimentary|metamorphic|weathering|erosion|deposition|tectonic|earthquake|volcano|fold|fault/i, 'Geology & Geomorphology'],
    [/river|stream|drainage|basin|delta|estuary|lake|ocean|sea|tide|wave|coral reef|hydrology|groundwater/i, 'Hydrology'],
    [/map|scale|projection|latitude|longitude|bearing|contour|grid reference|topography|survey/i, 'Cartography & Maps'],
    [/West Africa|Nigeria|Africa|continent|country|region|political geography|boundary/i, 'Regional Geography'],
    [/forest|vegetation|biome|savanna|rainforest|mangrove|grassland|desert vegetation|deforestation|conservation/i, 'Vegetation & Environment'],
  ],

  accounts: [
    [/trial balance|ledger|journal|double entry|debit|credit|posting|account|bookkeeping|accounting equation/i, 'Book-keeping Principles'],
    [/trading account|profit and loss|income statement|gross profit|net profit|revenue|expense|cost of sales/i, 'Trading & Profit/Loss Account'],
    [/balance sheet|assets|liabilities|capital|net worth|current asset|fixed asset|current liab|long.term/i, 'Balance Sheet'],
    [/cash (book|flow)|bank reconciliation|petty cash|imprest|cash budget|receipt|payment/i, 'Cash Book & Bank Reconciliation'],
    [/depreciation|accumulated depreciation|straight line|reducing balance|provision for depreciation|disposal|asset account/i, 'Depreciation'],
    [/partnership|partners|capital account|current account|appropriation|goodwill|dissolution|admission|retirement/i, 'Partnership Accounts'],
    [/company|limited|share|shareholder|dividend|debenture|public limited|private limited|share capital|profit and loss appropriation/i, 'Company Accounts'],
    [/control account|debtors control|creditors control|sales ledger|purchase ledger|reconciliation/i, 'Control Accounts'],
    [/incomplete records|single entry|statement of affairs|net worth method/i, 'Incomplete Records'],
    [/club|non-profit|receipts and payments|income and expenditure|subscription|accumulated fund/i, 'Non-Profit Accounts'],
    [/manufacturing account|work in progress|factory overhead|prime cost|cost of production/i, 'Manufacturing Accounts'],
    [/ratio analysis|liquidity ratio|profitability|current ratio|acid test|return on capital/i, 'Financial Analysis'],
    [/VAT|tax|payroll|PAYE|wages|salary|deduction|gross pay|net pay/i, 'Payroll & Taxation'],
  ],

  commerce: [
    [/opening stock|closing stock|sales.*purchase|cost of goods|gross profit|net profit|trading.*account|profit.*loss|balance.*sheet|assets|liabilities|capital.*account|depreciation.*commerce/i, 'Trade Accounts'],
    [/insurance|premium|policy|insured|insurer|underwriter|indemnity|subrogation|utmost good faith|life insurance|fire insurance|risk.*forecast|risk.*measured/i, 'Insurance'],
    [/bank|banking|commercial bank|central bank|investment.*bank|savings|loan|overdraft|interest|credit|mortgage|fixed deposit|cheque|bearer cheque|post.*dated|financial institution|home.*loan|NACCIMA|fund.*people/i, 'Banking & Finance'],
    [/stock exchange|share|debenture|securities|capital market|money market|stock broker|nationalization|privatization/i, 'Capital Market'],
    [/import|export|entrepot|re-export|visible|invisible|foreign trade|international.*commerce|ECOWAS.*trade|West African.*trade/i, 'International Trade'],
    [/transport|road|rail|sea|air|canal|pipeline|freight|shipping|logistics/i, 'Transport'],
    [/warehouse|storage|bonded warehouse|dock warrant|cold storage|elevator|silo/i, 'Warehousing'],
    [/retail|wholesale|middleman|distributor|chain store|supermarket|department store|channel of distribution|last link|vending machine|glass shield|shop.*front|number of shops/i, 'Retailing & Wholesaling'],
    [/communication|telephone|internet|postal|telegraph|advertising|media|post office|address|letter/i, 'Communication'],
    [/invoice|receipt|bill of lading|waybill|bill of exchange|promissory note|letter of credit|consignment note|CWO|documents of trade|unpaid seller|contract|agreement.*law|discharge.*contract/i, 'Trade Documents & Law'],
    [/consumer|consumerism|consumer protection|standard|quality|after.sales|pre.sale service/i, 'Consumer Affairs'],
    [/cooperative|NACCIMA|corporation|board.*federal|nationalization of industries/i, 'Business Organizations'],
    [/production|factor of production|entrepreneur.*risk|labour.*motivated|occupation.*broker|utility|services.*made|extraction.*industry|coal mining|construction industry|merger|vertical integration|horizontal|management.*function/i, 'Production & Business'],
    [/computer|keyboard|input.*device|output.*device|memory.*volatile|RAM|ROM|hardware|software/i, 'Information Technology'],
    [/trade|barter|home trade|function.*commerce|goods.*utility/i, 'Trade'],
    [/business|enterprise|entrepreneur|sole trader|partnership|company|organization/i, 'Business Organizations'],
  ],

  crk: [
    [/creation|genesis|Adam|Eve|Garden of Eden|fall of man|sin|redemption|covenant/i, 'Creation & Covenant'],
    [/Moses|Exodus|Passover|Red Sea|Sinai|Ten Commandments|law|Torah|Pentateuch/i, 'Moses & The Law'],
    [/David|Solomon|Samuel|Saul|king|kingdom|Israel|Judah|prophet|Elijah|Elisha/i, 'The Kings & Prophets'],
    [/Jesus|Christ|gospel|Matthew|Mark|Luke|John|sermon|miracle|parable|crucifixion|resurrection|ascension|nativity|baptism/i, 'Life of Jesus'],
    [/Paul|Acts|apostle|mission|church|Corinthians|Romans|Galatians|Ephesians|Philippians|epistle/i, 'Pauline Epistles & Acts'],
    [/prayer|worship|faith|hope|love|charity|Holy Spirit|salvation|grace|repentance|forgiveness|eternal life/i, 'Christian Living'],
    [/Revelation|apocalypse|eschatology|second coming|judgement|heaven|hell/i, 'Eschatology'],
    [/marriage|family|divorce|sexuality|ethics|social justice|poverty|wealth/i, 'Christian Ethics & Society'],
  ],

  irk: [
    [/Allah|tawhid|iman|pillars of islam|shahada|monotheism|shirk|attributes of Allah|belief|oneness|Almighty|creator|worship.*Allah/i, 'Tawhid & Iman'],
    [/Quran|Qur|revelation|surah|ayah|chapter.*quran|verse.*quran|recitation|tajweed|memorization|hafiz/i, 'Quran'],
    [/hadith|sunnah|saying.*prophet|tradition.*prophet|narrator|sahih|chain of transmiss/i, 'Hadith & Sunnah'],
    [/salat|prayer|wudu|ablution|adhan|mosque|direction of prayer|times of prayer|juma|congregational|daily prayer|five times|rak\'a|sujud|ruku/i, 'Salat'],
    [/zakat|sadaqah|charity|fasting|ramadan|sawm|hajj|mecca|umrah|zakah|pilgrimage|iftar|suhur|night.*power/i, 'Pillars of Islam'],
    [/marriage|divorce|nikah|mahr|family|talaq|inheritance.*islam|halal|haram|Islamic law|sharia|fiqh|forbidden|permitted|lawful|unlawful/i, 'Islamic Ethics & Law'],
    [/prophet|Ibrahim|Musa|Isa|Adam|Nuh|Yusuf|Dawud|Sulaiman|companions|seerah|hijra|migration|conquest.*mecca|battle|caliphate|caliph|Umar|Uthman|Ali|Abu Bakr/i, 'Prophets & Islamic History'],
    [/jihad|peace|war|justice|society|community|ummah|brotherhood|unity.*muslim|social.*islam|rights.*islam|neighbour|charity.*community/i, 'Islamic Society'],
    [/angel|jinn|heaven|hell|day of judgement|resurrection|paradise|accountability|unseen|belief.*angel/i, 'Eschatology & Unseen'],
  ],

  agric: [
    [/soil|texture|structure|pH|fertility|erosion|conservation|organic matter|humus|profile|horizon|topsoil/i, 'Soil Science'],
    [/crop|cultivation|planting|harvesting|weed|pest|disease|yield|season|annual|perennial|rotation/i, 'Crop Production'],
    [/livestock|cattle|poultry|pig|goat|sheep|animal husbandry|breed|fattening|feed|veterinary|disease control/i, 'Animal Husbandry'],
    [/farm|machinery|equipment|tractor|implement|irrigation|drainage|mechanization/i, 'Farm Machinery & Irrigation'],
    [/fertilizer|nutrient|NPK|nitrogen|phosphorus|potassium|organic manure|compost|liming/i, 'Soil Fertility & Fertilizers'],
    [/marketing|cooperative|storage|processing|agro-industry|value chain|farm income/i, 'Agricultural Marketing'],
    [/forestry|timber|wood|deforestation|afforestation|conservation|wildlife|biodiversity/i, 'Forestry & Environment'],
    [/fish|fishing|aquaculture|pond|freshwater|marine|fishery/i, 'Fisheries'],
    [/genetics|breeding|selection|hybrid|cross.breed|improvement|variety/i, 'Agricultural Science'],
  ],

  history: [
    [/pre-colonial|indigenous|traditional|kingdom|empire|Oyo|Benin|Kanem-Bornu|Bornu|Sokoto|Hausa|Yoruba|Igbo|Fulani|jihad.*history|emirate|oba|sultan|emir|ancient.*nigeria|early.*state|Nri|Arochukwu|Jukun|Nupe/i, 'Pre-Colonial History'],
    [/colonial|British|colonialism|protectorate|amalgamation|Lugard|indirect rule|Berlin Conference|partition|colony|mandate|scramble.*Africa|European.*Africa|administration.*colonial|warrant chief/i, 'Colonial Period'],
    [/independence|nationalism|NCNC|NPC|AG|Azikiwe|Awolowo|Balewa|self-determination|decolonization|nationalist|Nnamdi|Obafemi|Tafawa|independence.*1960|freedom.*colonial/i, 'Nationalism & Independence'],
    [/civil war|Biafra|military|coup|head of state|republic|federation|Gowon|Ironsi|Ojukwu|Obasanjo|second republic|third republic|constitution.*nigeria|state creation/i, 'Post-Independence Nigeria'],
    [/slave trade|slavery|abolition|Atlantic|trans-saharan|diaspora|African diaspora|middle passage|plantation|Wilberforce|abolitionist/i, 'Slave Trade'],
    [/World War|international|global|Europe|America|Pan-Africanism|Organization of African Unity|OAU|AU|League of Nations|Cold War|imperialism.*global|colonialism.*world/i, 'World & International History'],
    [/Egypt|ancient|civilization|Roman|Greek|medieval|Renaissance|revolution.*France|American.*revolution|French.*revolution/i, 'World History'],
  ],

  computer: [
    [/hardware|CPU|processor|memory|RAM|ROM|storage|input|output|motherboard|peripheral|monitor|keyboard/i, 'Computer Hardware'],
    [/software|operating system|application|program|Windows|Linux|system software|utility/i, 'Software'],
    [/algorithm|flowchart|pseudocode|programming|BASIC|COBOL|FORTRAN|Pascal|Java|Python|C\+\+|loop|conditional|variable|data type/i, 'Programming'],
    [/database|file|record|field|table|SQL|query|DBMS|normalization|primary key/i, 'Database'],
    [/internet|network|LAN|WAN|protocol|TCP\/IP|HTTP|browser|email|website|web|server|client|topology|bandwidth/i, 'Networking & Internet'],
    [/data representation|binary|bit|byte|ASCII|Unicode|number system|conversion/i, 'Data Representation'],
    [/spreadsheet|Excel|word processor|presentation|office application|Microsoft|desktop publishing/i, 'Office Applications'],
    [/security|virus|malware|firewall|encryption|backup|password|cybercrime/i, 'Computer Security'],
  ],

  physics_default: [
    [/.*/i, 'General Physics'],
  ],
};

// Subjects that use a generic fallback topic
const FALLBACK_TOPIC: Record<string, string> = {
  yoruba:            'Yoruba Language',
  hausa:             'Hausa Language',
  igbo:              'Igbo Language',
  french:            'French Language',
  arabic:            'Arabic Language',
  'home-economics':  'Home Management',
  catering:          'Catering & Food',
  pe:                'Physical Education',
  'animal-husbandry':'Animal Husbandry',
  'fine-arts':       'Fine Arts',
  music:             'Music',
  'book-keeping':    'Book Keeping',
  'data-processing': 'Data Processing',
  'office-practice': 'Office Practice',
  marketing:         'Marketing',
  insurance:         'Insurance',
  'civic-education': 'Civic Education',
};

// Subject display names for generic fallback topics
const SUBJECT_DISPLAY: Record<string, string> = {
  math: 'Mathematics', english: 'English', biology: 'Biology', chemistry: 'Chemistry',
  physics: 'Physics', economics: 'Economics', government: 'Government', literature: 'Literature',
  geography: 'Geography', accounts: 'Accounts', commerce: 'Commerce', crk: 'CRK',
  irk: 'IRK', agric: 'Agriculture', history: 'History', computer: 'Computer Studies',
  'further-math': 'Further Mathematics',
};

function classify(subject: string, questionText: string): string | null {
  const rules = RULES[subject];
  if (rules) {
    for (const [pattern, topic] of rules) {
      if (pattern.test(questionText)) return topic;
    }
    // Has rules but no match → generic fallback for that subject
    if (SUBJECT_DISPLAY[subject]) return `General ${SUBJECT_DISPLAY[subject]}`;
  }
  if (FALLBACK_TOPIC[subject]) return FALLBACK_TOPIC[subject];
  return null;
}

async function run(): Promise<void> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT id, subject, question_text
      FROM questions
      WHERE topic IS NULL OR topic = ''
      ORDER BY subject, id
    `);

    if (rows.length === 0) { console.log('✅ All questions already have topics.'); return; }
    console.log(`\n📊 Classifying ${rows.length} questions...\n`);

    let classified = 0, unclassified = 0;
    const bySubject: Record<string, { classified: number; unclassified: number }> = {};

    for (const q of rows) {
      const topic = classify(q.subject, q.question_text);
      bySubject[q.subject] = bySubject[q.subject] || { classified: 0, unclassified: 0 };
      if (topic) {
        await client.query('UPDATE questions SET topic = $1 WHERE id = $2', [topic, q.id]);
        classified++;
        bySubject[q.subject].classified++;
      } else {
        unclassified++;
        bySubject[q.subject].unclassified++;
      }
      if ((classified + unclassified) % 1000 === 0) {
        process.stdout.write(`\r  ✓ Processed ${classified + unclassified}/${rows.length}...`);
      }
    }

    console.log('\n\n📈 Results by subject:');
    for (const [subject, stats] of Object.entries(bySubject).sort()) {
      const total = stats.classified + stats.unclassified;
      const pct = Math.round((stats.classified / total) * 100);
      console.log(`  ${subject.padEnd(20)} ${stats.classified}/${total} classified (${pct}%)`);
    }
    console.log(`\n🎉 Done! ${classified} classified, ${unclassified} unclassified out of ${rows.length}.\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
