# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**FlatMate** — A web application for a 12-unit apartment in India. The President manages fees, expenses, and maintenance issues. Residents track payments, raise issues, and view reports. Built with a fully free, open-source stack with PhonePe UPI payment integration.

## Detailed Docs

All planning and architecture docs live in `.claude/docs/`:

| File | Contents |
|------|----------|
| `overview.md` | Project goals, roles, modules, non-functional requirements |
| `phases.md` | Phased build plan (Phase 1–5) |
| `architecture.md` | Tech stack, folder structure, data flow |
| `database-schema.md` | Full Prisma schema with enums and relations |
| `security.md` | Auth, RLS, rate limiting, audit logs, CSP |
| `phonepe-integration.md` | PhonePe PG API flow and webhook verification |

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL via Supabase (free tier)
- **ORM**: Prisma
- **Auth**: NextAuth.js v5 with Google OAuth (Gmail login)
- **UI**: Tailwind CSS + shadcn/ui
- **Storage**: Supabase Storage
- **Email**: Nodemailer + Gmail SMTP
- **Payments**: PhonePe Payment Gateway
- **Rate Limiting**: Upstash Redis (free tier)
- **PDF**: React-PDF
- **Hosting**: Vercel (free tier)

## Dev Commands

```bash
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Production build
npm run lint         # ESLint check
npx prisma migrate dev --name <name>   # Create and apply migration
npx prisma studio    # Open Prisma DB GUI
npx prisma generate  # Regenerate Prisma client after schema change
npx prisma db push   # Push schema to DB without migration (dev only)
```

## Role Model

| Role | Access |
|------|--------|
| `SUPER_ADMIN` | System config, role transfers, all data |
| `PRESIDENT` | Fee management, expenses, issue assignment, reports, announcements |
| `RESIDENT` | Pay fees, raise issues, view own data, public reports, announcements |

## Key Conventions

- All API routes validate session role via `getServerSession()` before any DB operation
- Every financial action (payment, expense create/edit/delete) must write to `audit_logs`
- PhonePe webhook must verify SHA-256 signature before updating payment status — never trust unverified callbacks
- Use Zod schemas for all API input validation
- Supabase Row Level Security (RLS) is a second line of defense — middleware is the first
- Keep secrets in `.env.local` — never hardcode merchant keys, DB URLs, or OAuth secrets
- 12 units: flat numbers should be configurable, not hardcoded
