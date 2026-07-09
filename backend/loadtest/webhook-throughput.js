// Goal: how many Telegram updates/second can the webhook ingest and route before
// latency degrades or the 50-connection Postgres pool starts queuing?
//
// Deliberately safe against the shared DB: telegram_id is a fake, never-seeded number,
// so db.getUser() returns null and every real handler exits before touching Postgres.
// This measures webhook ingestion + routing overhead (Express, Telegraf's update
// dispatch, the burst-protection Redis check) — NOT the cost of full answer processing,
// since that needs real seeded users and would pollute production attempts/analytics.
// If you ever stand up an isolated dev DB, extend this with real seeded telegram_ids
// to also measure the full write path.
//
// Requires: the server you're hitting must have the webhook route mounted, which only
// happens when APP_URL is set AND NODE_ENV=production (see src/index.ts launch()).
// Run locally with:
//   NODE_ENV=production APP_URL=http://localhost:3001 npm run dev
// then:
//   k6 run --env TARGET=http://localhost:3001 loadtest/webhook-throughput.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const TARGET = __ENV.TARGET || 'http://localhost:3001';

export const options = {
  scenarios: {
    qotd_answer_spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '2m', target: 300 },  // simulates a chunk of the user base answering
        { duration: '2m', target: 300 },  // QOTD within the same few-minute window
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800'],
  },
};

// 900,000,000+ is well above real Telegram user ID ranges at time of writing —
// deliberately fake, never present in the users table.
function fakeUpdate(vu, iter) {
  const uid = 900000000 + vu;
  return JSON.stringify({
    update_id: uid * 100000 + iter,
    callback_query: {
      id: `${uid}${iter}`,
      from: { id: uid, first_name: 'LoadTest', is_bot: false },
      data: 'qotd:answer:1:A',
      message: { message_id: 1, date: Math.floor(Date.now() / 1000), chat: { id: uid, type: 'private' } },
    },
  });
}

export default function () {
  const res = http.post(`${TARGET}/bot`, fakeUpdate(__VU, __ITER), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, { 'webhook accepted (200)': (r) => r.status === 200 });
  sleep(Math.random() * 2);
}
