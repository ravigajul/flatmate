# FlatMate

A web application for managing a residential apartment complex in India. The President manages maintenance fees, expenses, and issues. Residents pay fees via PhonePe UPI, raise maintenance issues, and view financial reports.

## Features

- **Google OAuth** login for all residents
- **Role-based access**: Super Admin, President, Resident
- **Fee management**: Monthly schedules, due tracking, late fees
- **PhonePe UPI payments** with webhook verification
- **Maintenance issue tracker**: Raise, assign, resolve, escalate
- **Expense tracking** with receipt attachments
- **Financial reports**: Balance sheet, PDF exports
- **Announcements** and **Document vault**
- **Email notifications** via Gmail SMTP

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Database | PostgreSQL (Supabase) |
| ORM | Prisma 5 |
| Auth | NextAuth.js v5 + Google OAuth |
| UI | Tailwind CSS + shadcn/ui |
| Storage | Supabase Storage |
| Email | Nodemailer + Gmail SMTP |
| Payments | PhonePe Payment Gateway |
| Rate Limiting | Upstash Redis |
| Hosting | Vercel |

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/ravigajul/flatmate.git
cd flatmate
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in all values in `.env.local`.

### 3. Set up the database

```bash
npx prisma migrate dev --name init
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Seed the first Super Admin

After signing in with Google for the first time, open Prisma Studio:

```bash
npx prisma studio
```

Find your user row → set `role` to `SUPER_ADMIN` and `isActive` to `true` → Save.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in all values:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Random secret — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | App URL (`http://localhost:3000` for dev) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `PHONEPE_MERCHANT_ID` | PhonePe merchant ID |
| `PHONEPE_MERCHANT_KEY` | PhonePe merchant key |
| `PHONEPE_KEY_INDEX` | PhonePe key index (usually `1`) |
| `PHONEPE_ENV` | `SANDBOX` or `PRODUCTION` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `GMAIL_USER` | Gmail address for sending emails |
| `GMAIL_APP_PASSWORD` | Gmail App Password |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |

## Dev Commands

```bash
npm run dev                              # Start dev server
npm run build                            # Production build
npm run lint                             # ESLint
npx prisma migrate dev --name <name>     # Create and apply migration
npx prisma studio                        # Open Prisma DB GUI
npx prisma generate                      # Regenerate Prisma client
```

## Security

- All secrets in environment variables — never hardcoded
- Role-based middleware protects every route
- PhonePe webhooks verified with SHA-256 signature
- Supabase Row Level Security as second line of defense
- All financial actions logged to an immutable audit trail
- Zod validation on all API inputs
- Rate limiting via Upstash Redis

## License

MIT
