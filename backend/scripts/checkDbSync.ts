// scripts/checkDbSync.ts — Compare content between the local and prod databases.
//
// Read-only: it never writes to either side. Run it at the end of any content job
// (explanation rewrite, answer-key audit, dedupe, topic fix) to confirm the change
// reached both databases.
//
//   PROD_DATABASE_URL=postgresql://...proxy.rlwy.net:PORT/railway npm run db:sync-check
//
// Options:
//   --table questions     only check one table
//   --skip theory_questions   leave a table out (repeatable, comma-separated)
//   --samples 20          how many example keys to print per difference (default 8)
//
// Exits 0 when everything matches, 1 when there is drift, 2 on a setup problem.
import dotenv from 'dotenv';
dotenv.config();

import { Client } from 'pg';

interface TableSpec {
  table: string;
  // Column that identifies "the same row" on both sides
  key: string;
  // Content columns to compare. Bookkeeping columns (timestamps, counters) are left
  // out on purpose: they are expected to differ.
  columns: string[];
  // Optional second identifier, used to spot rows that exist on both sides under
  // different `key` values (e.g. the same question imported with a different id).
  altKey?: string;
}

const TABLES: TableSpec[] = [
  {
    table: 'questions',
    key: 'id',
    altKey: 'source_id',
    columns: [
      'source_id', 'exam_type', 'subject', 'year', 'topic', 'question_text',
      'option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'correct_option',
      'explanation', 'explanation_reviewed', 'has_diagram', 'image_url', 'is_active',
    ],
  },
  {
    table: 'theory_questions',
    key: 'source_id',
    columns: ['exam_type', 'subject', 'year', 'question_text', 'worked_solution', 'is_active'],
  },
  {
    table: 'did_you_know',
    key: 'external_id',
    columns: ['subject', 'subject_code', 'topic', 'fact_text', 'difficulty'],
  },
  {
    table: 'subjects',
    key: 'code',
    columns: ['name', 'emoji'],
  },
];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function describe(url: string): string {
  const u = new URL(url);
  return `${u.hostname}:${u.port || 5432}${u.pathname}`;
}

async function connect(url: string): Promise<Client> {
  const client = new Client({ connectionString: url });
  await client.connect();
  // Belt and braces: even a bug in this script cannot write
  await client.query('SET default_transaction_read_only = on');
  return client;
}

async function columnsOf(client: Client, table: string): Promise<Set<string>> {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return new Set(rows.map((r) => r.column_name));
}

async function schemaOf(client: Client): Promise<Map<string, Set<string>>> {
  const { rows } = await client.query(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`
  );
  const out = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!out.has(r.table_name)) out.set(r.table_name, new Set());
    out.get(r.table_name)!.add(r.column_name);
  }
  return out;
}

// key -> one md5 per compared column. Hashing in Postgres keeps the transfer small
// even for long explanations.
async function fingerprints(
  client: Client,
  spec: TableSpec,
  columns: string[]
): Promise<Map<string, string[]>> {
  const hashes = columns.map((c) => `md5(coalesce("${c}"::text, ''))`).join(', ');
  const alt = spec.altKey ? `, "${spec.altKey}"::text AS alt` : '';
  const { rows } = await client.query({
    text: `SELECT "${spec.key}"::text AS k, ${hashes}${alt} FROM "${spec.table}" WHERE "${spec.key}" IS NOT NULL`,
    rowMode: 'array',
  });
  const out = new Map<string, string[]>();
  for (const r of rows as string[][]) out.set(r[0], r.slice(1));
  return out;
}

async function main(): Promise<void> {
  const localUrl = process.env.DATABASE_URL;
  const prodUrl = process.env.PROD_DATABASE_URL;
  if (!localUrl || !prodUrl) {
    console.error('Need DATABASE_URL (local, from backend/.env) and PROD_DATABASE_URL (Railway public proxy URL).');
    process.exit(2);
  }
  if (describe(localUrl) === describe(prodUrl)) {
    console.error('DATABASE_URL and PROD_DATABASE_URL point at the same database. Nothing to compare.');
    process.exit(2);
  }

  const onlyTable = arg('table');
  const samples = Number(arg('samples') || 8);
  const skip = new Set((arg('skip') || '').split(',').map((t) => t.trim()).filter(Boolean));
  const specs = (onlyTable ? TABLES.filter((t) => t.table === onlyTable) : TABLES).filter((t) => !skip.has(t.table));
  if (!specs.length) {
    console.error(`Unknown table "${onlyTable}". Known: ${TABLES.map((t) => t.table).join(', ')}`);
    process.exit(2);
  }

  console.log(`local: ${describe(localUrl)}`);
  console.log(`prod:  ${describe(prodUrl)}\n`);

  const local = await connect(localUrl);
  const prod = await connect(prodUrl);
  let drift = 0;

  try {
    // ── Schema: tables/columns present on one side only ──────────────────────
    const [ls, ps] = await Promise.all([schemaOf(local), schemaOf(prod)]);
    const schemaNotes: string[] = [];
    for (const t of new Set([...ls.keys(), ...ps.keys()])) {
      const a = ls.get(t);
      const b = ps.get(t);
      if (!a) { schemaNotes.push(`table ${t}: only on prod`); continue; }
      if (!b) { schemaNotes.push(`table ${t}: only on local`); continue; }
      for (const c of a) if (!b.has(c)) schemaNotes.push(`${t}.${c}: only on local`);
      for (const c of b) if (!a.has(c)) schemaNotes.push(`${t}.${c}: only on prod`);
    }
    if (schemaNotes.length) {
      drift += schemaNotes.length;
      console.log(`SCHEMA  ✗ ${schemaNotes.length} difference(s)`);
      for (const n of schemaNotes.sort()) console.log(`   ${n}`);
      console.log('');
    } else {
      console.log('SCHEMA  ✓ same tables and columns\n');
    }

    // ── Content ──────────────────────────────────────────────────────────────
    for (const spec of specs) {
      const [lc, pc] = await Promise.all([columnsOf(local, spec.table), columnsOf(prod, spec.table)]);
      if (!lc.size || !pc.size) {
        console.log(`${spec.table}  – skipped (missing on ${!lc.size ? 'local' : 'prod'})\n`);
        continue;
      }
      const columns = spec.columns.filter((c) => lc.has(c) && pc.has(c));
      const [L, P] = await Promise.all([fingerprints(local, spec, columns), fingerprints(prod, spec, columns)]);

      const onlyLocal = [...L.keys()].filter((k) => !P.has(k));
      const onlyProd = [...P.keys()].filter((k) => !L.has(k));
      const perColumn = columns.map(() => [] as string[]);
      let rowsDiffering = 0;
      for (const [k, lv] of L) {
        const pv = P.get(k);
        if (!pv) continue;
        let rowDiffers = false;
        for (let i = 0; i < columns.length; i++) {
          if (lv[i] !== pv[i]) { perColumn[i].push(k); rowDiffers = true; }
        }
        if (rowDiffers) rowsDiffering++;
      }

      const tableDrift = onlyLocal.length + onlyProd.length + rowsDiffering;
      drift += tableDrift;
      const head = `${spec.table}  ${tableDrift ? '✗' : '✓'}  local ${L.size} rows, prod ${P.size} rows`;
      console.log(tableDrift ? head : `${head}, all ${columns.length} columns match`);

      const show = (keys: string[]) =>
        keys.slice(0, samples).join(', ') + (keys.length > samples ? `, … (+${keys.length - samples} more)` : '');

      if (onlyLocal.length) console.log(`   only on local (${onlyLocal.length}): ${spec.key} ${show(onlyLocal)}`);
      if (onlyProd.length) console.log(`   only on prod  (${onlyProd.length}): ${spec.key} ${show(onlyProd)}`);

      // Same row, different key: usually a re-import that handed out a new id
      if (spec.altKey && (onlyLocal.length || onlyProd.length)) {
        const altIdx = columns.length; // alt value is appended after the hashes
        const prodByAlt = new Map(onlyProd.map((k) => [P.get(k)![altIdx], k] as const));
        const moved = onlyLocal
          .map((k) => ({ k, alt: L.get(k)![altIdx] }))
          .filter((x) => x.alt && prodByAlt.has(x.alt))
          .map((x) => `${x.alt}: local ${spec.key} ${x.k} / prod ${spec.key} ${prodByAlt.get(x.alt)}`);
        if (moved.length) {
          console.log(`   same ${spec.altKey}, different ${spec.key} (${moved.length}): fixes written by ${spec.key} will miss these`);
          for (const m of moved.slice(0, samples)) console.log(`      ${m}`);
        }
      }

      if (rowsDiffering) {
        console.log(`   ${rowsDiffering} shared row(s) differ:`);
        columns.forEach((c, i) => {
          if (perColumn[i].length) console.log(`      ${c.padEnd(22)} ${String(perColumn[i].length).padStart(6)}   ${spec.key} ${show(perColumn[i])}`);
        });
      }
      console.log('');
    }
  } finally {
    await Promise.allSettled([local.end(), prod.end()]);
  }

  if (drift) {
    console.log('✗ Local and prod are OUT OF SYNC. See above.');
    process.exit(1);
  }
  console.log('✓ Local and prod match.');
}

main().catch((err) => {
  console.error('Sync check failed:', err.message);
  process.exit(2);
});
