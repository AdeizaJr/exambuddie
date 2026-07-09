// Goal: can the landing site's pageview beacon handle a viral-post-style traffic spike
// (thousands of visitors within minutes) without degrading?
//
// Safe to run against the shared DB — /api/track only writes to page_views, a table
// built purely for this. Clean up afterward with the DELETE at the bottom of this file.
//
// Run:  k6 run --env TARGET=http://localhost:3001 loadtest/landing-pageview-spike.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const TARGET = __ENV.TARGET || 'http://localhost:3001';

export const options = {
  scenarios: {
    viral_spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 200 },   // warm up
        { duration: '1m', target: 2000 },   // the "influencer post just dropped" ramp
        { duration: '2m', target: 2000 },   // sustain
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'], // fail the run if p95 exceeds 500ms — tune to your real goal
    http_req_failed: ['rate<0.01'],
  },
};

const PAGES = ['/', '/waec', '/jamb', '/neco', '/waec/math', '/jamb/english', '/blog'];

export default function () {
  const path = PAGES[Math.floor(Math.random() * PAGES.length)];
  const res = http.post(
    `${TARGET}/api/track`,
    JSON.stringify({
      path,
      referrer: Math.random() < 0.4 ? 'https://www.tiktok.com/@exambuddieapp' : null,
      utmSource: 'loadtest',
      utmMedium: null,
      utmCampaign: null,
      visitorId: `k6-loadtest-${__VU}-${__ITER}`,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(res, { 'tracked (204)': (r) => r.status === 204 });
  sleep(Math.random() * 1.5); // real visitors don't all land in the same millisecond
}

// Cleanup, after the run:
//   DELETE FROM page_views WHERE utm_source = 'loadtest';
