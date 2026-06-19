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
- Flutterwave account (for payments)

---

## Backend Setup

```bash
cd backend
npm install
cp .env.example .env   # fill in your values
npm run migrate        # create DB tables
npm run seed           # load subjects + sample questions
npm run dev            # development (long polling)
```

### Key environment variables

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | From BotFather |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `APP_URL` | Public URL of your backend (enables webhook mode) |
| `ANTHROPIC_API_KEY` | For AI explanation generation |
| `FLUTTERWAVE_SECRET_KEY` | Payment processing |
| `FLUTTERWAVE_WEBHOOK_HASH` | Webhook verification |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Admin dashboard login |
| `JWT_SECRET` | Admin session signing |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (miniapp + admin-ui URLs) |
| `FREE_DAILY_LIMIT` | Max questions per day for free users (default: 5) |

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
| `/practice` | Start a practice session |
| `/quiz` | 60-question timed mock exam — 50 min (premium) |
| `/drill` | Drill your weakest topics |
| `/challenge` | Create or join a multiplayer challenge room (create = premium) |
| `/invite` | Get your referral link — invite 2 friends, earn 3 days Premium free |
| `/leaderboard` | Weekly accuracy leaderboard (top 10) |
| `/stats` | View accuracy and progress |
| `/subscribe` | Upgrade to Premium |
| `/settings` | Change exam type, subjects, or phone number |
| `/app` | Open the ExamBuddie Web App |
| `/stop` | End current session |
| `/help` | List all commands |

---

## Freemium Model

| Feature | Free | Premium |
|---------|------|---------|
| Questions per day | 5 (configurable) | Unlimited |
| Practice mode | ✅ | ✅ |
| Quiz mode (60Q, 50 min) | ❌ | ✅ |
| Topic drill | ❌ | ✅ |
| Per-question timer | ❌ | ✅ |
| Progress tracking | ✅ | ✅ |
| Weak topic detection | ✅ | ✅ |
| Weekly leaderboard | ✅ | ✅ |
| Weekly performance reports | ❌ | ✅ |
| Challenge Mode — join a room | ✅ | ✅ |
| Challenge Mode — create a room | ❌ | ✅ |
| Referral rewards (/invite) | ✅ | ✅ |

---

## Deployment (Railway)

1. Push to GitHub
2. Create a Railway project, connect your repo
3. Set all environment variables from `.env`
4. Set **Build Command**: `npm run build:all`
5. Set **Start Command**: `npm start`
6. Set `APP_URL` to your Railway public URL
7. Set Flutterwave webhook to: `https://your-app.railway.app/webhooks/flutterwave`

Landing page deploys separately (Vercel recommended).

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
