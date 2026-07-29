# Security Policy

## Reporting a Vulnerability

If you find a security vulnerability in ExamBuddie, please report it privately — not through a public GitHub issue.

**Preferred:** Use [GitHub's private vulnerability reporting](https://github.com/AdeizaJr/exambuddie/security/advisories/new) for this repository (Security tab → Report a vulnerability).

**Fallback:** Email hello@exambuddie.app with the subject line `SECURITY:` followed by a short description.

We aim to acknowledge reports within 3 business days.

## What to Include

- A clear description of the vulnerability and its potential impact
- Steps to reproduce (a minimal proof of concept, if possible)
- The affected component (bot, API, miniapp, admin dashboard, landing site)
- Any relevant logs, screenshots, or request/response examples

## Scope

In scope:
- The Telegram bot and its command handlers
- The backend API (`backend/`)
- The miniapp (`miniapp/`)
- The admin dashboard (`admin-ui/`)
- The landing/marketing site (`landing/`)
- Authentication, session handling, and payment/webhook flows

Out of scope:
- Social engineering or physical attacks
- Denial of service / rate-limit exhaustion testing against production
- Third-party services we integrate with but don't control (Telegram, Paystack, Railway) — report those directly to the vendor
- Findings that require a compromised device or browser extension already installed on the victim's machine

## Disclosure

Please give us a reasonable window to fix a confirmed issue before any public disclosure. We'll credit reporters (if desired) once a fix ships.
