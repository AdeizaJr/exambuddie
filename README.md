# 🎓 ExamBuddie — WAEC, JAMB & NECO Exam Prep on Telegram

> Practice 50,000+ real past questions with instant explanations and progress tracking — right inside Telegram.

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
- Flutterwave account (for payments)

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
| `ANTHROPIC_API_KEY` | For AI explanation generation scripts |
| `FLUTTERWAVE_SECRET_KEY` | Payment processing |
| `FLUTTERWAVE_WEBHOOK_HASH` | Webhook verification |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Admin dashboard login |
| `JWT_SECRET` | Admin session signing |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (miniapp + admin-ui URLs) |
| `FREE_DAILY_LIMIT` | Max questions per day for free users (default: 5) |
| `SUPPORT_CHAT_ID` | Telegram chat/group ID to receive bug reports (optional) |
| `ZOHO_SMTP_USER` | Zoho Mail address e.g. `hello@exambuddie.app` |
| `ZOHO_SMTP_PASS` | Zoho app-specific password |
| `ZOHO_SMTP_TO` | Inbox that receives support emails (defaults to `ZOHO_SMTP_USER`) |
| `MONTHLY_PRICE_NGN` | Monthly plan price in kobo (default: `1500`) |
| `TERM_PRICE_NGN` | 3-month plan price in kobo (default: `3500`) |
| `YEARLY_PRICE_NGN` | Yearly plan price in kobo (default: `12000`) |

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
npm run dev          # runs at localhost:5174
```

Point `VITE_API_URL` in `admin-ui/.env.local` to your backend URL.

---

## Landing Page Setup

```bash
cd landing
npm install
npm run dev          # runs at localhost:3000
```

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
| `/formula` | Quick-access formula sheets (Physics, Chemistry, Maths, Further Maths, Biology, Economics, Government) |
| `/timetable` | 2026 exam timetable with countdown per subject (WAEC/NECO/JAMB) |
| `/challenge` | Create or join a multiplayer challenge room (create = premium) |
| `/invite` | Referral link — invite 2 friends → 3 days Premium free |
| `/leaderboard` | Weekly accuracy leaderboard (top 10) with rank badges + last week's results |
| `/stats` | Accuracy, daily target, exam countdown, rank badge, weak topic tip |
| `/progress` | Streak, subject coverage bars, referral status + shareable card |
| `/badges` | Achievement badges — grouped by Questions, Streaks, Quiz & Exams, Accuracy (17 total) |
| `/subscribe` | Upgrade to Premium |
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

**Pricing:** ₦1,500/month · ₦3,500/term (3 months) · ₦12,000/year

---

## Admin API Endpoints

All endpoints require a JWT Bearer token (obtained via `POST /api/admin/login`).

| Endpoint | Description |
|----------|-------------|
| `POST /api/admin/login` | Authenticate, returns JWT |
| `GET /api/admin/stats` | Users, premium count, attempts today, revenue |
| `GET /api/admin/acquisition` | Signup breakdown by source |
| `GET /api/admin/flags` | Open flagged explanations |
| `GET /api/admin/flags/top-questions` | Most-flagged questions (top 20) |
| `POST /api/admin/flags/:id/resolve` | Resolve a flag (optionally save edited explanation/text) |
| `GET /api/admin/questions` | Paginated question list with search + filters |
| `PUT /api/admin/questions/:id` | Edit question text, options, correct answer, explanation |
| `PATCH /api/admin/questions/:id/active` | Toggle question active/inactive |
| `POST /api/admin/questions/:id/generate-explanation` | AI-generate explanation via Claude API |
| `DELETE /api/admin/questions/:id` | Delete a question |
| `GET /api/admin/users` | Paginated user list with search |
| `PUT /api/admin/users/:telegramId/plan` | Change user plan (free/premium) + expiry |
| `DELETE /api/admin/users` | Delete users by ID list or search filter |
| `GET /api/admin/analytics/hard-questions` | Questions with ≥10 attempts and ≥70% wrong rate |
| `POST /api/admin/broadcast` | Send message to all/waec/jamb/neco/premium/free users |
| `POST /api/admin/dm` | Send direct message to a single user by telegram_id |

---

## Deployment (Railway)

1. Push to GitHub
2. Create a Railway project, connect your repo
3. Set all environment variables from `.env`
4. Set **Build Command**: `npm run build:all`
5. Set **Start Command**: `npm start`
6. Set `APP_URL` to your Railway public URL
7. Set Flutterwave webhook to: `https://your-app.railway.app/webhooks/flutterwave`

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
| Admin UI | React + Vite |
| Landing | Next.js |
| AI Explanations | Anthropic Claude API |
| Payments | Flutterwave |
| Hosting | Railway (backend) |

---

## License

MIT © ExamBuddie 2026
