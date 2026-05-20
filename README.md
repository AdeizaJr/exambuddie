# 🎓 ExamAce — AI Exam Prep Bot for Nigerian Students

> WAEC & JAMB past questions, AI-powered explanations, and progress tracking — right inside Telegram.

---

## Quick Start (5 steps)

### 1. Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- A Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- Anthropic API key
- Flutterwave account (for payments)

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env with your actual values
```

### 4. Set Up Database
```bash
# Make sure PostgreSQL is running, then:
npm run migrate    # Creates all tables
npm run seed       # Loads subjects + 20 sample questions
```

### 5. Start the Bot
```bash
npm run dev        # Development (long polling)
npm start          # Production (uses webhook if APP_URL is set)
```

---

## Project Structure

```
examace/
├── src/
│   ├── index.js                  # Entry point — bot + server launch
│   ├── bot/
│   │   ├── formatter.js          # All message templates & keyboards
│   │   └── handlers/
│   │       ├── onboarding.js     # /start, /settings, profile setup
│   │       ├── practice.js       # Practice mode, drills, answers
│   │       ├── quiz.js           # Quiz mode (40Q timed)
│   │       └── stats.js          # /stats, /subscribe, payment flow
│   ├── db/
│   │   └── index.js              # PostgreSQL queries & helpers
│   ├── services/
│   │   ├── redis.js              # Session state, rate limiting
│   │   ├── payments.js           # Flutterwave integration
│   │   └── cron.js               # Daily resets, weekly summaries
│   └── api/
│       └── server.js             # Express: webhooks, admin API
├── admin/
│   └── index.html                # Admin dashboard (open in browser)
├── scripts/
│   ├── migrate.js                # Run DB migrations
│   ├── seed.js                   # Seed sample questions
│   └── generateExplanations.js  # Batch-generate Claude explanations
└── .env.example
```

---

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Onboarding or main menu for returning users |
| `/practice` | Start a practice session (unlimited for premium) |
| `/quiz` | 40-question timed mock exam (premium only) |
| `/drill [topic]` | Practice a specific topic (e.g. `/drill Algebra`) |
| `/stats` | View progress, accuracy, weak topics |
| `/subscribe` | Upgrade to Premium |
| `/settings` | Change exam type or subjects |
| `/stop` | End current session and see results |
| `/help` | List all commands |

---

## Freemium Model

| Feature | Free | Premium (₦800/mo or ₦7,000/yr) |
|---------|------|------|
| Questions/day | 5 | Unlimited |
| Practice mode | ✅ | ✅ |
| Quiz mode (timed) | ❌ | ✅ |
| Topic drill | ❌ | ✅ |
| Progress tracking | ❌ | ✅ |
| Weak topic detection | ❌ | ✅ |
| Weekly summaries | ❌ | ✅ |

---

## Admin Dashboard

Open `admin/index.html` in a browser (or serve it from your host).

It connects to your running API and requires your `ADMIN_SECRET`.

Features:
- Real-time user & question stats
- Flagged explanation review queue
- User management table
- Revenue metrics

---

## Adding More Questions

### Option A: Extend the seed file
Edit `scripts/seed.js` and add more entries to the `sampleQuestions` array.

### Option B: Import pipeline (production)
Build a CSV import pipeline that maps columns to the questions table schema:
```sql
exam_type, subject, year, topic, question_text,
option_a, option_b, option_c, option_d, correct_option
```

Then run:
```bash
npm run generate-explanations   # Claude generates explanations for new questions
```

---

## Deployment (Render.com)

1. Push to GitHub
2. Create new Web Service on Render
3. Set environment variables from `.env`
4. Set `APP_URL` to your Render URL
5. Set start command: `npm start`
6. Add PostgreSQL and Redis add-ons
7. Set Flutterwave webhook URL to: `https://your-app.onrender.com/webhooks/flutterwave`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Bot framework | [Telegraf.js](https://telegraf.js.org/) |
| Runtime | Node.js 18 |
| Database | PostgreSQL + pg |
| Cache / Sessions | Redis |
| AI Explanations | Anthropic Claude API |
| Payments | Flutterwave |
| Cron jobs | node-cron |
| Hosting | Render.com (recommended) |

---

## Phase 2 Roadmap (Months 4–6)

- [ ] WhatsApp Business API integration
- [ ] NECO & GCE question banks
- [ ] AI-personalized weekly study plans
- [ ] Leaderboards (school/class level)
- [ ] Referral system

---

## License

MIT © ExamAce 2026
