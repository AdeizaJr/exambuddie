# 🎓 ExamBuddie — WAEC, JAMB & NECO Exam Prep on Telegram

> Practice 41,000+ real past questions with instant explanations and progress tracking — right inside Telegram.

---

## Project Structure

```
exambuddie/
├── backend/       # Telegram bot + Express API (TypeScript)
├── miniapp/       # Telegram Web App — rich UI inside Telegram (React + Vite)
├── admin-ui/      # Admin dashboard (React + Vite)
└── landing/       # Marketing site (Next.js)
```

---

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- Anthropic API key (for AI explanations)
- Paystack account (for payments)

---

## Backend Setup

```bash
cd backend
npm install
cp .env.example .env   # fill in your values
npm run migrate              # create DB tables
npm run seed                 # load subjects + sample questions
npm run format-explanations  # pre-render LaTeX explanations to Unicode (run once after seeding)
npm run dev                  # development (long polling)
```

### Key environment variables

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | From BotFather |
| `BOT_USERNAME` | Your bot's Telegram username e.g. `ExamBuddieBot` |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `APP_URL` | Public URL of your backend (enables webhook mode) |
| `LANDING_URL` | Public URL of the landing site — pinged every 4 min to prevent Railway idle sleep (default: `https://exambuddie.app`) |
| `ANTHROPIC_API_KEY` | For AI explanation generation scripts |
| `PAYSTACK_SECRET_KEY` | Payment processing + webhook signature verification |
| `PAYSTACK_PUBLIC_KEY` | Client-side payment init (if ever needed) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Admin dashboard login |
| `JWT_SECRET` | Admin session signing |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (miniapp + admin-ui URLs) |
| `FREE_DAILY_LIMIT` | Max questions per day for free users (default: 5) |
| `SUPPORT_CHAT_ID` | Telegram chat/group ID to receive bug reports (optional) |
| `ZOHO_SMTP_USER` | Zoho Mail address e.g. `hello@exambuddie.app` |
| `ZOHO_SMTP_PASS` | Zoho app-specific password |
| `ZOHO_SMTP_TO` | Inbox that receives support emails (defaults to `ZOHO_SMTP_USER`) |

> Pricing and the free daily question limit are **no longer env vars** — they live in the `settings`
> DB table, seeded by `npm run migrate`, and are editable from the admin dashboard's Pricing page.

### Testing Paystack webhooks locally (ngrok)

Paystack needs a public URL to send webhook events to — your local `npm run dev` server isn't reachable from the internet. Use [ngrok](https://ngrok.com/download) to tunnel it:

```bash
ngrok config add-authtoken <your-token>   # one-time setup, from ngrok dashboard
ngrok http 3000                            # or whatever port your backend runs on
```

Then:
1. Copy the `https://xxxx.ngrok-free.app` URL ngrok gives you.
2. Set `APP_URL` in `.env` to that URL and restart `npm run dev`.
3. In Paystack dashboard (Settings → API Keys & Webhooks), point the webhook URL to `https://xxxx.ngrok-free.app/webhooks/paystack`.
4. Trigger a test event from Paystack's dashboard, or make a real test payment, to confirm delivery.

> The ngrok URL changes every time you restart the tunnel (free plan) — update both `APP_URL` and the Paystack dashboard webhook URL each time.

---

## Miniapp Setup

The Telegram Web App is served by the backend at `/app`.

```bash
cd backend
npm run build:all    # builds miniapp → copies to dist/miniapp/ → compiles backend TS
npm start
```

Miniapp is then live at `APP_URL/app`.

For miniapp-only development:

```bash
cd miniapp
npm install
npm run dev          # runs at localhost:5173/app
```

---

## Admin UI Setup

```bash
cd admin-ui
npm install
npm run dev          # runs at localhost:5173 (next free port if taken)
```

The admin UI is only the screen. It needs the backend running to log in or load data:

- Leave `VITE_API_URL` empty in `admin-ui/.env.local` for local work. Requests to `/api` are then proxied to the backend at `localhost:3001`, so start it first (`cd backend && npm run dev`).
- Set `VITE_API_URL` to a backend URL to point at a remote backend instead.

If login says it can't reach the server, the backend is not running. The first admin account is created from `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `backend/.env`.

---

## Landing Page Setup

```bash
cd landing
npm install
cp .env.example .env   # set API_URL to your backend, so pricing on the site stays live
npm run dev          # runs at localhost:3000
```

If `API_URL` is unset, the pricing section and Terms page fall back to hardcoded defaults instead of erroring.

---

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Onboarding or main menu |
| `/practice` | Start a practice session (year picker, multi-subject for premium) |
| `/quiz` | 50-question timed CBT exam — 60 min (premium) |
| `/mock` | Full mock exam (simulates real WAEC/JAMB/NECO experience) |
| `/drill` | Drill your weakest topics |
| `/review` | Spaced repetition — review cards due today |
| `/revision` | Practise only questions you previously got wrong |
| `/bookmarks` | View and practise your saved questions |
| `/formula` | Quick-access formula sheets (Physics, Chemistry, Maths, Further Maths, Biology, Economics, Government, English, Geography, Literature, Financial Accounting, Agricultural Science, Commerce, Computer Studies, CRK, IRK) |
| `/timetable` | Exam timetable with countdown per subject (WAEC/NECO/JAMB) — each subject auto-rolls to next year once its sitting has passed |
| `/challenge` | Create or join a multiplayer challenge room (create = premium) |
| `/invite` | Referral link — invite 2 friends → 3 days Premium free |
| `/leaderboard` | Weekly accuracy leaderboard (top 10) with rank badges + last week's results |
| `/stats` | Accuracy, daily target, exam countdown, rank badge, weak topic tip |
| `/progress` | Streak, subject coverage bars, referral status + shareable card |
| `/badges` | Achievement badges — grouped by Questions, Streaks, Quiz & Exams, Accuracy (17 total) |
| `/subscribe` | Upgrade to Premium |
| `/billing` | View billing history, cancel or manage auto-renewal |
| `/settings` | Exam type, subjects, phone number, daily reminder time |
| `/support` | Report a bug, request data, or delete your account |
| `/app` | Open the ExamBuddie Web App |
| `/stop` | End current session |
| `/help` | List all commands |

---

## Freemium Model

| Feature | Free | Premium |
|---------|------|---------|
| 14-day Premium trial on first signup | ✅ | — |
| Questions per day | 5 (configurable) | Unlimited |
| Practice mode (with year picker 2010–2026) | ✅ | ✅ |
| Multi-subject practice session | ❌ | ✅ |
| CBT mode (50Q, 60 min) | ❌ | ✅ |
| Mock exam | ❌ | ✅ |
| Topic drill | ❌ | ✅ |
| Per-question timer | ❌ | ✅ |
| Spaced repetition review (/review) | ❌ | ✅ |
| Post-quiz wrong answer walkthrough | ❌ | ✅ |
| Revision mode (/revision) | ✅ | ✅ |
| Bookmark questions (/bookmarks) | ✅ | ✅ |
| Formula sheets (/formula) | ✅ | ✅ |
| Exam timetable with countdown (/timetable) | ✅ | ✅ |
| Question of the Day (QOTD broadcast) | ✅ | ✅ |
| Daily auto-challenge at reminder hour | ✅ | ✅ |
| Daily target progress in /stats | ✅ | ✅ |
| Shareable quiz result card after CBT | ❌ | ✅ |
| Streak freeze (once/week) | ❌ | ✅ |
| Daily reminder opt-in (custom WAT hour) | ✅ | ✅ |
| Subject coverage bars in /progress | ✅ | ✅ |
| Shareable progress card | ✅ | ✅ |
| Achievement badges (/badges) — 17 badges, 4 categories | ✅ | ✅ |
| Rank system — 30 ranks (Rookie → Legend), based on total questions answered | ✅ | ✅ |
| Exam countdown in /stats | ✅ | ✅ |
| Weak topic detection + drill tip | ✅ | ✅ |
| Topic mastery breakdown | ✅ | ✅ |
| Weekly leaderboard + archive | ✅ | ✅ |
| Weekly performance reports | ❌ | ✅ |
| Milestone celebrations | ✅ | ✅ |
| Challenge Mode — join a room | ✅ | ✅ |
| Challenge Mode — create a room | ❌ | ✅ |
| 1v1 Duel | ❌ | ✅ |
| Referral rewards (/invite) — 2 friends → 3 days free | ✅ | ✅ |
| Referral leaderboard | ✅ | ✅ |

**Pricing:** Set from the admin dashboard's Pricing page (see /subscribe in the bot for current prices). If the customer's card supports recurring charges, Premium auto-renews each cycle via Paystack subscriptions; otherwise it's a one-off payment that expires and must be manually renewed. Cancel or manage auto-renewal anytime with /billing.

---

## Admin API Endpoints

All endpoints require a JWT Bearer token (obtained via `POST /api/admin/login`).

| Endpoint | Description |
|----------|-------------|
| `POST /api/admin/login` | Authenticate, returns JWT |
| `PUT /api/admin/password` | Change admin password |
| `GET /api/admin/stats` | Users, premium count, attempts today, revenue |
| `GET /api/admin/acquisition` | Signup breakdown by source |
| `GET /api/admin/flags` | Open flagged explanations |
| `GET /api/admin/flags/top-questions` | Most-flagged questions (top 20) |
| `POST /api/admin/flags/:id/resolve` | Resolve a flag (optionally save edited explanation/text) |
| `GET /api/admin/alerts` | Open (unresolved) system alerts |
| `POST /api/admin/alerts/:id/resolve` | Resolve an alert |
| `GET /api/admin/questions` | Paginated question list with search + filters |
| `PUT /api/admin/questions/:id` | Edit question text, options, correct answer, explanation |
| `PATCH /api/admin/questions/:id/active` | Toggle question active/inactive |
| `POST /api/admin/questions/:id/generate-explanation` | AI-generate explanation via Claude API |
| `DELETE /api/admin/questions/:id` | Delete a question |
| `POST /api/admin/questions/:id/image` | Upload/replace a question's diagram image |
| `DELETE /api/admin/questions/:id/image` | Remove a question's diagram image |
| `POST /api/admin/questions/bulk-import` | Bulk-import questions from JSON (max 500 per request) |
| `GET /api/admin/users` | Paginated user list with search |
| `PUT /api/admin/users/:telegramId/plan` | Change user plan (free/premium) + expiry |
| `DELETE /api/admin/users` | Delete users by ID list or search filter |
| `GET /api/admin/users/:telegramId/activity` | Single user's attempt history, subject breakdown, weak topics |
| `GET /api/admin/users/export` | CSV export of all users |
| `GET /api/admin/subscriptions` | Subscription/payment history with recurring status |
| `GET /api/admin/analytics` | 14-day dashboard: daily attempts, subjects, missing explanations, flags, weak topics, DAU |
| `GET /api/admin/analytics/hard-questions` | Questions with ≥10 attempts and ≥70% wrong rate |
| `GET /api/admin/analytics/pageviews` | Landing page pageview stats |
| `GET /api/admin/analytics/growth` | Signup/growth trend over time |
| `GET /api/admin/analytics/retention` | Cohort retention breakdown |
| `GET /api/admin/analytics/funnel` | Onboarding → first answer → premium conversion funnel |
| `GET /api/admin/analytics/ranks` | Per-user total-answered counts, used for rank distribution |
| `GET /api/admin/leaderboard` | Current weekly leaderboard |
| `GET /api/admin/leaderboard/weeks` | List of past leaderboard weeks (archive index) |
| `GET /api/admin/leaderboard/snapshot` | Archived leaderboard for a given past week |
| `GET /api/admin/qotd` | Preview candidate Question of the Day picks |
| `POST /api/admin/dm` | Send direct message to a single user by telegram_id |
| `POST /api/admin/broadcast` | Send message to all/waec/jamb/neco/premium/free users |
| `GET /api/admin/broadcast/history` | Last 50 broadcasts sent (message, target, sent/failed/total) |
| `GET /api/admin/pricing` | Current pricing + free daily limit |
| `PUT /api/admin/pricing` | Update pricing — pushes changes to live Paystack plans immediately |
| `GET /api/admin/pricing/history` | Audit log of pricing changes (who, when, old → new) |

---

## Deployment (Railway)

1. Push to GitHub
2. Create a Railway project, connect your repo
3. Set all environment variables from `.env`
4. Set **Build Command**: `npm run build:all`
5. Set **Start Command**: `npm start`
6. Set `APP_URL` to your Railway public URL
7. Set Paystack webhook to: `https://your-app.railway.app/webhooks/paystack` (Settings → API Keys & Webhooks in Paystack dashboard). Make sure `charge.success`, `subscription.create`, `subscription.disable`, `subscription.not_renew`, and `invoice.payment_failed` events are enabled — recurring billing depends on all of them.

Landing page deploys separately on Railway (same process — connect repo, set build/start commands).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Bot framework | Telegraf.js |
| Backend language | TypeScript / Node.js 18 |
| Database | PostgreSQL |
| Cache / Sessions | Redis |
| Miniapp | React + Vite + Tailwind CSS |
| Admin UI | React + Vite + Tailwind CSS 3, Lucide icons, Inter font |
| Landing | Next.js + Tailwind CSS 4, Geist font |
| AI Explanations | Anthropic Claude API |
| Payments | Paystack |
| Hosting | Railway (backend) |

### UI conventions

- **Brand color is blue.** Landing uses Tailwind `blue-700` for primary actions. Admin uses the `accent` tokens in `admin-ui/tailwind.config.js`.
- **Green means good news only**: success messages, revenue, healthy metrics, correct answers. In admin that is the `success` token, not `accent`.
- Landing font is set once through `--font-sans` in `landing/app/globals.css`. Use the `font-sans` class, not `font-[var(--font-geist)]` (Tailwind 4 reads that as a font weight and the font silently fails to load).

---

## License

MIT © ExamBuddie 2026
