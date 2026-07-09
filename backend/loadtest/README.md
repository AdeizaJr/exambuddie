# Load testing ExamBuddie

Tool: [k6](https://k6.io) (`brew install k6` or download a binary). Scripted in JS, no GUI needed.

## Before running anything: the DB is shared

There's no separate dev/staging database in this project — `DATABASE_URL` points at the
same Postgres instance everywhere, including local `ts-node` scripts. That constrains
what's safe to load test:

- **Safe**: anything that only writes to `page_views` (built for exactly this) or
  reads without writing.
- **Not safe as a casual script**: simulating full answer processing against real user
  IDs — it writes to `attempts`, skews the mistake-pattern detector, leaderboards, and
  DAU/MAU counts, and requires seeded users to even exercise the real code path.

`webhook-throughput.js` works around this by using fake, never-seeded telegram IDs —
`db.getUser()` returns null and every handler exits before writing anything. It measures
ingestion/routing throughput, not full answer-processing cost. If a real isolated dev DB
ever exists, that's the point to extend it with seeded users for the full picture.

## The two real traffic spikes worth testing

Not "test the API" — the actual shapes traffic takes here:

1. **Landing site viral spike** — a TikTok/IG post takes off, thousands hit
   `exambuddie.app` within minutes. `landing-pageview-spike.js`.
2. **Bot's own self-inflicted spike** — QOTD broadcasts to every user each morning, and a
   chunk answer within the same few-minute window. `webhook-throughput.js`.

Payment (`/subscribe`) is deliberately not included here — lowest volume, highest cost if
broken, and worth testing manually/carefully rather than blasted with synthetic load
against a shared Paystack integration.

## Running

```bash
# 1. Landing pageview spike — safe to run as-is
k6 run --env TARGET=http://localhost:3001 loadtest/landing-pageview-spike.js

# 2. Bot webhook throughput — needs the webhook route mounted (production mode)
NODE_ENV=production APP_URL=http://localhost:3001 npm run dev
# in another terminal:
k6 run --env TARGET=http://localhost:3001 loadtest/webhook-throughput.js
```

## Cleanup after running

```sql
DELETE FROM page_views WHERE utm_source = 'loadtest';
```

`webhook-throughput.js` needs no cleanup — it never writes anything.

## What "done" looks like

Not "0 errors." A number: *"at N concurrent [visitors / QOTD-answerers], p95 latency is
Xms, and [the DB pool starts queuing / response times start climbing] past Y."* That
number — where it actually starts degrading — is the thing worth knowing, not just
whether it technically survived.

Watch, while a script runs:

- k6's own summary: `http_req_duration` p95/p99, `http_req_failed` rate.
- The backend process's own console output for Postgres pool-timeout errors —
  `db/index.ts` caps the pool at `max: 50`; that's the first thing worth finding the
  ceiling of.
