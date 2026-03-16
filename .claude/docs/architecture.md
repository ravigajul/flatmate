# Architecture

## Tech Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Framework | Next.js | 14 (App Router) | Full-stack, SSR, API routes, free hosting on Vercel |
| Language | TypeScript | 5.x | Type safety across frontend and backend |
| Database | PostgreSQL (Supabase) | Latest | Reliable, free 500MB tier, built-in RLS, open source |
| ORM | Prisma | 5.x | Type-safe queries, migration management, prevents SQL injection |
| Auth | NextAuth.js | v5 (beta) | Google OAuth, JWT sessions, CSRF protection, open source |
| UI Components | shadcn/ui | Latest | Accessible, unstyled base components built on Radix UI |
| Styling | Tailwind CSS | 3.x | Utility-first, responsive, small bundle |
| File Storage | Supabase Storage | — | Free 1GB, same platform as DB, S3-compatible API |
| Email | Nodemailer + Gmail SMTP | — | Completely free, reliable for low volume (apartment scale) |
| Payments | PhonePe Payment Gateway | — | Widest UPI adoption in India, open source Node SDK |
| PDF Generation | React-PDF (`@react-pdf/renderer`) | — | Open source, server-side PDF generation |
| Input Validation | Zod | 3.x | Schema validation for all API inputs |
| Rate Limiting | Upstash Redis | — | 10,000 req/day free tier, serverless-friendly |
| Hosting | Vercel | — | Free tier, zero-ops, auto-deploys from GitHub |
| Charts | Recharts | — | Open source, React-native chart library |

## Deployment Topology

```
Browser (Mobile / Desktop)
        │
        ▼
   Vercel (Next.js)
   ├── App Router pages (SSR / RSC)
   ├── API Routes (/api/*)
   └── Middleware (auth + role check)
        │
        ├──► Supabase PostgreSQL (DB via Prisma)
        ├──► Supabase Storage (images, documents)
        ├──► Upstash Redis (rate limiting)
        ├──► Gmail SMTP (email via Nodemailer)
        └──► PhonePe PG API (payment initiation)
                │
                ▼
        PhonePe Checkout (UPI)
                │
                ▼ (webhook)
        /api/webhooks/phonepe (signature verified)
```

## Folder Structure

```
/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx              # Google sign-in page
│   ├── (dashboard)/
│   │   ├── layout.tsx                # Shared dashboard layout + nav
│   │   ├── president/
│   │   │   ├── page.tsx              # President home dashboard
│   │   │   ├── units/                # Unit management
│   │   │   ├── users/                # Resident management + invites
│   │   │   ├── fees/                 # Fee schedules + dues overview
│   │   │   ├── expenses/             # Expense recording
│   │   │   ├── issues/               # All issues management
│   │   │   ├── announcements/        # Create announcements
│   │   │   └── reports/              # All reports
│   │   └── resident/
│   │       ├── page.tsx              # Resident home dashboard
│   │       ├── pay/                  # Payment page
│   │       ├── history/              # Payment history
│   │       ├── issues/               # My issues + raise new
│   │       ├── announcements/        # View announcements
│   │       └── reports/              # Public financial reports
│   ├── api/
│   │   ├── auth/[...nextauth]/       # NextAuth handler
│   │   ├── users/                    # User CRUD
│   │   ├── units/                    # Unit CRUD
│   │   ├── fees/                     # Fee schedule management
│   │   ├── payments/
│   │   │   └── initiate/             # PhonePe order creation
│   │   ├── webhooks/
│   │   │   └── phonepe/              # PhonePe payment callback
│   │   ├── expenses/                 # Expense CRUD
│   │   ├── issues/                   # Issue CRUD + status transitions
│   │   ├── announcements/            # Announcement CRUD
│   │   ├── documents/                # Document upload + list
│   │   └── reports/                  # Report data endpoints
│   ├── layout.tsx                    # Root layout
│   └── page.tsx                      # Landing / redirect to login
├── components/
│   ├── ui/                           # shadcn/ui generated components
│   ├── forms/                        # Reusable form components
│   ├── tables/                       # Data table components
│   ├── charts/                       # Recharts wrappers
│   └── pdf/                          # React-PDF document templates
├── lib/
│   ├── auth.ts                       # NextAuth config (Google provider, callbacks)
│   ├── prisma.ts                     # Prisma client singleton
│   ├── supabase.ts                   # Supabase client (storage)
│   ├── phonepe.ts                    # PhonePe SDK wrapper + signature utils
│   ├── email.ts                      # Nodemailer transporter + email templates
│   ├── redis.ts                      # Upstash rate limiter setup
│   └── utils.ts                      # Shared helpers
├── middleware.ts                     # Auth + role-based route protection
├── prisma/
│   ├── schema.prisma                 # Full database schema
│   └── migrations/                   # Auto-generated migration files
├── types/
│   └── index.ts                      # Shared TypeScript types
└── .env.local                        # All secrets (never committed)
```

## Auth Flow

```
User visits app
    │
    ▼
middleware.ts checks session
    │
    ├── No session → redirect to /login
    └── Has session
            │
            ├── Role = PRESIDENT → allow /president/* routes
            ├── Role = RESIDENT  → allow /resident/* routes
            └── Role = SUPER_ADMIN → allow all routes

Login Flow:
    User clicks "Sign in with Google"
    → NextAuth redirects to Google OAuth
    → Google returns profile (email, name, avatar)
    → NextAuth `signIn` callback:
        - Check if user exists in DB by email
        - If new: create user with RESIDENT role (President assigns unit later)
        - If exists: return existing user with their role
    → Session contains: { id, email, name, role, unitId }
```

## Payment Data Flow

```
1. Resident clicks "Pay ₹XXXX"
2. POST /api/payments/initiate
   - Validate session (RESIDENT role)
   - Create pending Payment record in DB
   - Build PhonePe payload (merchantId, orderId, amount, callbackUrl)
   - Sign payload with SHA-256 (merchantKey)
   - Call PhonePe API → get redirectUrl
3. App redirects resident to PhonePe checkout
4. Resident pays via UPI / PhonePe wallet
5. PhonePe POSTs to /api/webhooks/phonepe
   - Verify X-VERIFY header (SHA-256 signature)
   - If invalid signature → reject 400
   - If valid → decode base64 response
   - Update Payment status to SUCCESS / FAILED
   - On SUCCESS: write audit_log, send email receipt
6. PhonePe also redirects browser to /resident/pay?status=success
```

## Environment Variables

```
# Database
DATABASE_URL=

# Auth
NEXTAUTH_URL=
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# PhonePe
PHONEPE_MERCHANT_ID=
PHONEPE_MERCHANT_KEY=
PHONEPE_KEY_INDEX=
PHONEPE_ENV=SANDBOX  # or PRODUCTION

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Email
GMAIL_USER=
GMAIL_APP_PASSWORD=

# Upstash
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```
