# Architecture

## Tech Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Framework | Next.js | 15.x (App Router) | Full-stack SSR, API routes, middleware, free Vercel hosting |
| Language | TypeScript | 5.x | Type safety across frontend and backend |
| Database | PostgreSQL (Supabase) | Latest | Free 500 MB tier, built-in RLS, managed backups |
| ORM | Prisma | 5.x | Type-safe queries, migration management, SQL injection prevention |
| Auth | NextAuth.js | v5 | Google OAuth, JWT sessions, CSRF protection |
| UI Components | shadcn/ui + Tailwind CSS | Latest | Accessible Radix UI base, utility-first styling |
| File Storage | Supabase Storage | — | Free 1 GB, same platform as DB, S3-compatible |
| Email | Nodemailer + Gmail SMTP | — | Free, reliable for low volume (12-unit scale) |
| Payments | PhonePe PG v1 | — | Widest UPI adoption in India, SHA-256 X-VERIFY signature |
| Input Validation | Zod | 4.x | Schema validation on all API inputs |
| Rate Limiting | Upstash Redis | — | 10,000 req/day free tier, serverless-friendly |
| Hosting | Vercel | — | Free tier, zero-ops, auto-deploys from GitHub |

---

## 1. System Deployment Topology

```mermaid
graph TB
    subgraph Clients["👥 Clients"]
        Browser["🌐 Browser\n(Mobile / Desktop)"]
    end

    subgraph Vercel["▲ Vercel (Next.js 15)"]
        Middleware["middleware.ts\nJWT auth + role check\n(Edge Runtime)"]
        Pages["App Router Pages\n(Server Components / SSR)"]
        API["API Routes\n/api/*"]
        Webhook["Webhook Handler\n/api/webhooks/phonepe"]
    end

    subgraph Supabase["🗄️ Supabase"]
        Postgres["PostgreSQL\n(Prisma ORM)\nRow Level Security"]
        Storage["Supabase Storage\nbucket: issue-photos\nbucket: documents"]
    end

    subgraph ExternalServices["🌐 External Services"]
        Google["Google OAuth\naccounts.google.com"]
        PhonePe["PhonePe PG v1\napi-preprod.phonepe.com\n(UAT Sandbox)"]
        Gmail["Gmail SMTP\nsmtp.gmail.com:587"]
        Upstash["Upstash Redis\nRate Limiting"]
    end

    Browser -->|"HTTPS request"| Middleware
    Middleware -->|"Authorized"| Pages
    Middleware -->|"Authorized"| API
    Middleware -->|"No auth (sig-verified)"| Webhook

    Pages -->|"Prisma queries"| Postgres
    API -->|"Prisma queries"| Postgres
    API -->|"File upload"| Storage
    API -->|"POST /pg/v1/pay\nX-VERIFY SHA-256"| PhonePe
    API -->|"sendMail()"| Gmail
    API -->|"ratelimit()"| Upstash

    PhonePe -->|"POST webhook\nX-VERIFY header"| Webhook
    Webhook -->|"Update payment status"| Postgres
    Webhook -->|"Send receipt email"| Gmail

    Browser -->|"OAuth redirect"| Google
    Google -->|"ID token + profile"| Middleware
```

---

## 2. Application Layer Architecture

```mermaid
graph TB
    subgraph NextApp["Next.js 15 App Router"]
        subgraph Layouts["Layouts"]
            RootLayout["app/layout.tsx\nRoot Layout\n(SessionProvider)"]
            DashLayout["app/(dashboard)/layout.tsx\nDashboard Layout\n(Sidebar + Header)"]
        end

        subgraph PresidentPages["🏛️ President Pages"]
            PDash["president/page.tsx\nDashboard (stats)"]
            PUnits["president/units/\nUnit management"]
            PUsers["president/users/\nResident management"]
            PFees["president/fees/\nFee schedules + dues"]
            PExpenses["president/expenses/\nExpense recording"]
            PIssues["president/issues/\nAll issues + detail"]
            PAnnounce["president/announcements/\nPost notices"]
            PDocs["president/documents/\nDocument vault"]
            PReports["president/reports/\nFinancial analytics"]
        end

        subgraph ResidentPages["🏠 Resident Pages"]
            RDash["resident/page.tsx\nDashboard (my status)"]
            RPay["resident/pay/\nPay fees + history"]
            RCallback["resident/pay/callback/\nPost-payment landing"]
            RIssues["resident/issues/\nMy issues + raise new"]
            RAnnounce["resident/announcements/\nView notices"]
            RDocs["resident/documents/\nView documents"]
            RReports["reports/\nPublic financial reports"]
        end

        subgraph APIRoutes["⚙️ API Routes"]
            AuthAPI["api/auth/[...nextauth]\nGoogle OAuth handler"]
            UsersAPI["api/users/[id]\nUser CRUD"]
            UnitsAPI["api/units/[id]\nUnit CRUD"]
            FeesAPI["api/fees/[id]\nFee schedule CRUD"]
            PayAPI["api/payments/initiate\nCreate PhonePe order"]
            PayHistory["api/payments/history\nPayment records"]
            WebhookAPI["api/webhooks/phonepe\nPayment callback"]
            IssuesAPI["api/issues/[id]\nIssue CRUD + status"]
            CommentsAPI["api/issues/[id]/comments\nThread comments"]
            ExpensesAPI["api/expenses/[id]\nExpense CRUD"]
            AnnounceAPI["api/announcements/[id]\nAnnouncement CRUD"]
            DocsAPI["api/documents/[id]\nDocument CRUD"]
            UploadAPI["api/upload\nSupabase file upload"]
            ReportsAPI["api/reports/summary\napi/reports/collection\nAggregated data"]
        end

        subgraph LibLayer["📚 lib/ — Server Utilities"]
            AuthLib["lib/auth.ts\nNextAuth + Prisma adapter\nJWT callbacks"]
            AuthConfig["lib/auth.config.ts\nEdge-safe config\n(for middleware)"]
            PrismaLib["lib/prisma.ts\nSingleton Prisma client"]
            PhonePeLib["lib/phonepe.ts\nX-VERIFY SHA-256\nPay / Status / Refund"]
            SupabaseLib["lib/supabase.ts\nService-role admin client\nStorage operations"]
            EmailLib["lib/email.ts\nNodemailer templates\nReceipt / Announcement / Status"]
            AuditLib["lib/audit.ts\nwriteAuditLog() helper"]
            RedisLib["lib/redis.ts\nUpstash rate limiter"]
        end

        subgraph Components["🧩 components/"]
            UIComp["ui/\nButton, Badge, Input\n(shadcn/ui)"]
            Sidebar["sidebar.tsx\nRole-aware nav links"]
            FeeMgr["fees/fee-manager.tsx\nGenerate fees modal"]
            IssueMgr["issues/issue-manage.tsx\nStatus + assignment panel"]
            CommentFm["issues/comment-form.tsx\nAdd comment (client)"]
            PayBtn["pay/pay-now-button.tsx\nInitiate payment (client)"]
        end
    end

    RootLayout --> DashLayout
    DashLayout --> PresidentPages
    DashLayout --> ResidentPages
    PresidentPages --> APIRoutes
    ResidentPages --> APIRoutes
    APIRoutes --> LibLayer
    PresidentPages --> Components
    ResidentPages --> Components
```

---

## 3. Authentication & Authorization Flow

```mermaid
sequenceDiagram
    participant U as 👤 User (Browser)
    participant MW as middleware.ts (Edge)
    participant NA as NextAuth /api/auth
    participant G as Google OAuth
    participant DB as PostgreSQL

    U->>MW: GET /resident/pay
    MW->>MW: Check JWT cookie
    alt No session
        MW-->>U: 302 Redirect → /login
        U->>NA: Click "Sign in with Google"
        NA-->>U: 302 Redirect → Google
        U->>G: Authenticate + consent
        G-->>NA: id_token (email, name, picture)
        NA->>DB: PrismaAdapter upsert User
        NA->>DB: SELECT role, unitId, isActive WHERE email=?
        NA-->>U: Set JWT cookie (id, role, unitId, isActive)
        U->>MW: GET /resident/pay (with cookie)
    end
    MW->>MW: Verify JWT signature
    MW->>MW: Check isActive
    alt isActive = false
        MW-->>U: 302 Redirect → /pending
    end
    MW->>MW: Check role vs route
    alt Wrong role (e.g. RESIDENT on /president/*)
        MW-->>U: 302 Redirect → /resident
    end
    MW-->>U: 200 Allow request
```

```mermaid
graph LR
    subgraph Roles["Role → Route Access Matrix"]
        SA["SUPER_ADMIN"] -->|Full access| All["/president/*\n/resident/*\n/admin/*\n/api/*"]
        PR["PRESIDENT"] -->|Management| Pres["/president/*\n/resident/*\n/reports/*\n/api/*"]
        RE["RESIDENT"] -->|Self-service| Res["/resident/*\n/reports/*\n/api/issues\n/api/payments"]
        INACTIVE["isActive=false"] -->|Blocked| Pend["/pending only"]
    end
```

---

## 4. Payment Flow (PhonePe v1)

```mermaid
sequenceDiagram
    participant R as 🏠 Resident (Browser)
    participant App as Next.js App
    participant DB as PostgreSQL
    participant PP as PhonePe PG v1
    participant WH as /api/webhooks/phonepe

    R->>App: POST /api/payments/initiate\n{ feeScheduleId }
    App->>App: Validate session (RESIDENT role)
    App->>DB: SELECT FeeSchedule WHERE id=?
    App->>DB: SELECT Payment WHERE feeScheduleId & status=SUCCESS
    alt Already paid
        App-->>R: 409 Conflict "Already paid"
    end
    App->>App: Calculate total = amount + lateFee (if overdue)
    App->>App: Generate merchantOrderId\n"fm" + UUID-no-dashes (≤38 chars)
    App->>DB: INSERT Payment (status=PENDING)
    App->>DB: INSERT AuditLog (PAYMENT_INITIATED)
    App->>App: Build payload JSON → base64 encode
    App->>App: Compute X-VERIFY =\nSHA256(base64 + "/pg/v1/pay" + saltKey)\n+ "###" + keyIndex
    App->>PP: POST /pg/v1/pay\nHeaders: X-VERIFY\nBody: { request: base64Payload }
    PP-->>App: { success: true, data.instrumentResponse.redirectInfo.url }
    App-->>R: { redirectUrl: "https://mercury-uat.phonepe.com/..." }
    R->>PP: Browser navigates to PhonePe checkout
    R->>PP: Pays via UPI / Card / Wallet
    PP-->>R: Redirect → /resident/pay/callback
    PP->>WH: POST webhook (async)\nHeaders: X-VERIFY\nBody: { response: base64JSON }
    WH->>WH: Compute expected =\nSHA256(base64Response + saltKey) + "###" + keyIndex
    WH->>WH: timingSafeEqual(received, expected)
    alt Invalid signature
        WH-->>PP: 400 Bad Request
    end
    WH->>WH: Decode base64 → { merchantTransactionId, state, transactionId }
    WH->>DB: SELECT Payment WHERE phonePeMerchantOrderId=?
    alt Already SUCCESS (idempotency)
        WH-->>PP: 200 OK (no-op)
    end
    alt state = COMPLETED
        WH->>DB: UPDATE Payment\nstatus=SUCCESS, phonePeTxnId, paidAt, paymentMethod
        WH->>DB: INSERT AuditLog (PAYMENT_SUCCESS)
        WH->>App: sendReceiptEmail(resident email)
    else state = FAILED
        WH->>DB: UPDATE Payment\nstatus=FAILED, failureReason
        WH->>DB: INSERT AuditLog (PAYMENT_FAILED)
    end
    WH-->>PP: 200 OK
```

---

## 5. Database Entity Relationship Diagram

```mermaid
erDiagram
    Unit {
        String id PK
        String flatNumber UK
        String block
        Int floor
        Float areaSqft
        String ownerName
        Boolean isOccupied
    }

    User {
        String id PK
        String email UK
        String name
        String phone
        Role role
        String unitId FK
        Boolean isActive
    }

    FeeSchedule {
        String id PK
        String unitId FK
        Float amount
        Float lateFee
        String monthYear
        DateTime dueDate
    }

    Payment {
        String id PK
        String unitId FK
        String feeScheduleId FK
        Float amount
        Float lateFeeApplied
        PaymentStatus status
        String phonePeTxnId UK
        String phonePeMerchantOrderId UK
        String paymentMethod
        DateTime paidAt
        String failureReason
    }

    Issue {
        String id PK
        String unitId FK
        String raisedById FK
        String title
        String description
        IssueCategory category
        IssuePriority priority
        IssueStatus status
        String assignedTo
        String[] photoUrls
        Boolean isEscalated
        DateTime resolvedAt
    }

    IssueComment {
        String id PK
        String issueId FK
        String authorId FK
        String text
        DateTime createdAt
    }

    Expense {
        String id PK
        Float amount
        ExpenseCategory category
        String vendor
        String description
        String receiptUrl
        DateTime expenseDate
        String addedById FK
    }

    Announcement {
        String id PK
        String title
        String body
        String attachmentUrl
        String postedById FK
        DateTime createdAt
    }

    Document {
        String id PK
        String name
        String url
        DocumentCategory category
        Int fileSize
        String uploadedById FK
    }

    AuditLog {
        String id PK
        String userId FK
        String action
        String entity
        String entityId
        Json metadata
        String ipAddress
        DateTime createdAt
    }

    Unit ||--o{ User : "has residents"
    Unit ||--o{ FeeSchedule : "has fee schedules"
    Unit ||--o{ Payment : "has payments"
    Unit ||--o{ Issue : "raises issues"
    FeeSchedule ||--o{ Payment : "paid via"
    Issue ||--o{ IssueComment : "has comments"
    User ||--o{ Issue : "raised by"
    User ||--o{ IssueComment : "authored by"
    User ||--o{ Expense : "added by"
    User ||--o{ Announcement : "posted by"
    User ||--o{ Document : "uploaded by"
    User ||--o{ AuditLog : "performed by"
```

---

## 6. Issue Lifecycle

```mermaid
stateDiagram-v2
    [*] --> OPEN : Resident raises issue\n(POST /api/issues)

    OPEN --> ASSIGNED : President assigns vendor\n(PATCH /api/issues/[id])
    OPEN --> IN_PROGRESS : President marks in progress
    OPEN --> ESCALATED : Auto-flagged after 7 days\n(isEscalated = true)

    ASSIGNED --> IN_PROGRESS : Work begins
    ASSIGNED --> ESCALATED : Unresolved after 7 days

    IN_PROGRESS --> RESOLVED : President marks resolved
    IN_PROGRESS --> ESCALATED : Unresolved after 7 days

    ESCALATED --> IN_PROGRESS : President takes action
    ESCALATED --> RESOLVED : President resolves

    RESOLVED --> CLOSED : President closes
    RESOLVED --> IN_PROGRESS : Resident reopens\n(within 48 hours of resolution)

    CLOSED --> [*]

    note right of OPEN
        Email sent to President
        on new issue creation
    end note

    note right of RESOLVED
        Email sent to Resident
        on status change
    end note
```

---

## 7. Request Lifecycle (Middleware → API → DB)

```mermaid
flowchart TD
    A["Incoming HTTP Request"] --> B["middleware.ts\n(Edge Runtime)"]

    B --> C{Public route?\n/login, /api/auth,\n/api/webhooks/phonepe}
    C -->|Yes| D["Pass through\nNextResponse.next()"]
    C -->|No| E{Valid JWT\ncookie?}

    E -->|No| F["302 → /login"]
    E -->|Yes| G{isActive?}

    G -->|false| H["302 → /pending"]
    G -->|true| I{Role check\nvs pathname}

    I -->|Wrong role| J["302 → /resident or /login"]
    I -->|OK| K["Route Handler\n(API or Page)"]

    K --> L["auth() — re-verify\nsession server-side"]
    L --> M{Session\nvalid?}
    M -->|No| N["401 Unauthorized"]
    M -->|Yes| O["Zod schema\nvalidation"]

    O --> P{Valid\ninput?}
    P -->|No| Q["400 Bad Request\n{ error: ZodError }"]
    P -->|Yes| R{Rate limit\ncheck (Redis)}

    R -->|Exceeded| S["429 Too Many Requests"]
    R -->|OK| T["Prisma DB query\nvia DATABASE_URL"]

    T --> U{DB\nsuccess?}
    U -->|Error| V["500 Internal Server Error\n(JSON body)"]
    U -->|OK| W["Audit log write\n(financial actions only)"]
    W --> X["200 / 201 JSON Response"]
```

---

## 8. File Upload Flow (Issue Photos)

```mermaid
sequenceDiagram
    participant R as 🏠 Resident (Browser)
    participant App as /api/upload
    participant SS as Supabase Storage\n(issue-photos bucket)

    R->>R: Select photo file\n(JPEG/PNG/WebP/HEIC, max 5MB)
    R->>App: POST /api/upload\nContent-Type: multipart/form-data\nBody: { file }
    App->>App: auth() — verify session
    App->>App: Validate MIME type\n(image/jpeg|png|webp|heic only)
    App->>App: Validate size ≤ 5MB
    App->>App: Generate storage path:\n"{userId}/{timestamp}.{ext}"
    App->>SS: supabaseAdmin.storage\n.from("issue-photos")\n.upload(path, buffer)
    SS-->>App: { error: null }
    App->>SS: .getPublicUrl(path)
    SS-->>App: { publicUrl: "https://...supabase.co/..." }
    App-->>R: 201 { url: publicUrl }
    R->>R: Show preview thumbnail\nStore URL for form submission
    R->>App: POST /api/issues\n{ photoUrls: [url1, url2, ...] }
```

---

## 9. Folder Structure (Actual)

```
/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx                  # Google sign-in page
│   ├── (dashboard)/
│   │   ├── layout.tsx                      # Sidebar + header wrapper
│   │   ├── president/
│   │   │   ├── page.tsx                    # Dashboard: open issues, fee stats
│   │   │   ├── units/page.tsx              # 12 units grid + edit modal
│   │   │   ├── users/page.tsx              # Resident list + role/unit assignment
│   │   │   ├── fees/
│   │   │   │   ├── page.tsx                # Fee overview + month picker
│   │   │   │   └── fee-manager.tsx         # Generate fees modal (client)
│   │   │   ├── expenses/
│   │   │   │   ├── page.tsx                # Expense list + filters
│   │   │   │   └── expense-manager.tsx     # Add/edit expense (client)
│   │   │   ├── issues/
│   │   │   │   ├── page.tsx                # All issues + filters
│   │   │   │   ├── issue-filters.tsx       # Status/category filter (client)
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx            # Issue detail + comments
│   │   │   │       ├── issue-manage.tsx    # Status/assignment panel (client)
│   │   │   │       └── comment-form.tsx    # Add comment (client)
│   │   │   ├── announcements/
│   │   │   │   ├── page.tsx
│   │   │   │   └── announcement-manager.tsx
│   │   │   ├── documents/
│   │   │   │   ├── page.tsx
│   │   │   │   └── document-manager.tsx
│   │   │   └── reports/page.tsx            # Charts + collection table
│   │   ├── resident/
│   │   │   ├── page.tsx                    # Dashboard: fee status, open issues
│   │   │   ├── pay/
│   │   │   │   ├── page.tsx                # Current fee card + payment history
│   │   │   │   ├── pay-now-button.tsx      # Initiate payment (client)
│   │   │   │   └── callback/page.tsx       # Post-payment landing (polling)
│   │   │   ├── issues/
│   │   │   │   ├── page.tsx                # My issues list
│   │   │   │   ├── new/page.tsx            # Raise issue form (3 photo slots)
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx            # Issue detail + comments
│   │   │   │       └── comment-form.tsx
│   │   │   ├── announcements/page.tsx
│   │   │   └── documents/
│   │   │       ├── page.tsx
│   │   │       └── doc-filters.tsx
│   │   └── reports/
│   │       ├── page.tsx                    # Public financial summary
│   │       └── collection-table.tsx
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts     # NextAuth handler
│   │   ├── users/
│   │   │   ├── route.ts                    # GET all, POST create
│   │   │   └── [id]/route.ts               # PATCH, DELETE
│   │   ├── units/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── fees/
│   │   │   ├── route.ts                    # GET + POST (generate for all units)
│   │   │   └── [id]/route.ts               # PATCH (edit amount/due date)
│   │   ├── payments/
│   │   │   ├── initiate/route.ts           # POST → PhonePe order
│   │   │   └── history/route.ts            # GET payment records
│   │   ├── webhooks/
│   │   │   └── phonepe/route.ts            # POST (signature-verified callback)
│   │   ├── issues/
│   │   │   ├── route.ts                    # GET (filtered) + POST
│   │   │   └── [id]/
│   │   │       ├── route.ts                # GET + PATCH (status/assign)
│   │   │       └── comments/route.ts       # POST comment
│   │   ├── expenses/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── announcements/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── documents/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── upload/route.ts                 # POST multipart → Supabase Storage
│   │   └── reports/
│   │       ├── summary/route.ts            # Totals + by-category breakdown
│   │       └── collection/route.ts         # Per-unit monthly status
│   ├── layout.tsx                          # Root layout + SessionProvider
│   └── page.tsx                            # Redirect to /login or dashboard
├── components/
│   ├── ui/                                 # shadcn/ui: Button, Badge, Input, etc.
│   └── sidebar.tsx                         # Role-aware navigation links
├── lib/
│   ├── auth.ts                             # NextAuth + PrismaAdapter + JWT callbacks
│   ├── auth.config.ts                      # Edge-safe config (for middleware)
│   ├── prisma.ts                           # Prisma singleton (prevent hot-reload leaks)
│   ├── supabase.ts                         # Supabase service-role admin client
│   ├── phonepe.ts                          # PhonePe v1: pay, status, refund
│   ├── email.ts                            # Nodemailer: receipt, announcement, status
│   ├── audit.ts                            # writeAuditLog() helper
│   ├── redis.ts                            # Upstash rate limiter
│   └── utils.ts                            # Shared helpers (formatCurrency, etc.)
├── middleware.ts                           # Edge: JWT verify + role-based routing
├── prisma/
│   ├── schema.prisma                       # Full DB schema (10 models)
│   └── migrations/                         # Auto-generated SQL migrations
├── __tests__/
│   ├── api/                                # 20 API route test files (Vitest)
│   └── lib/                                # 4 lib utility test files
├── vitest.config.ts                        # Coverage thresholds: 90% lines/functions
├── vitest.setup.ts
└── .env.local                              # All secrets (git-ignored)
```

---

## 10. Security Layers

```mermaid
graph TB
    subgraph L1["Layer 1 — Edge (middleware.ts)"]
        MW1["JWT signature verification"]
        MW2["isActive check → /pending"]
        MW3["Role-to-route enforcement"]
        MW4["Webhook bypass (signature-verified separately)"]
    end

    subgraph L2["Layer 2 — API Route Guards"]
        AG1["auth() re-verify on every handler"]
        AG2["Role assertion (e.g. role !== 'PRESIDENT' → 403)"]
        AG3["Ownership check (resident can only touch own data)"]
        AG4["Zod schema validation on all inputs"]
        AG5["Rate limiting via Upstash Redis"]
    end

    subgraph L3["Layer 3 — Database (Supabase RLS)"]
        RLS1["users: read own row only"]
        RLS2["payments: read own unit only"]
        RLS3["issues: read own issues only"]
        RLS4["audit_logs: DENY UPDATE/DELETE for all"]
        RLS5["expenses: read-only for residents"]
    end

    subgraph L4["Layer 4 — Webhook Verification"]
        WH1["SHA-256 HMAC of base64 body + saltKey"]
        WH2["Constant-time comparison (timingSafeEqual)"]
        WH3["Idempotency: skip if already SUCCESS"]
    end

    subgraph L5["Layer 5 — File Upload Security"]
        FU1["MIME type whitelist (JPEG/PNG/WebP/HEIC)"]
        FU2["Max size: 5 MB per file"]
        FU3["Path: {userId}/{timestamp}.{ext} (no traversal)"]
        FU4["Server-side only upload (service role key)"]
    end

    Request --> L1 --> L2 --> L3
    PaymentWebhook --> L4 --> L3
    FileUpload --> L5 --> L3
```

---

## 11. Environment Variables

```bash
# ── Database ──────────────────────────────────────────────
DATABASE_URL="postgresql://..."             # Supabase connection string

# ── Auth ──────────────────────────────────────────────────
NEXTAUTH_URL="http://localhost:3000"        # App base URL (localhost for dev)
NEXTAUTH_SECRET="..."                       # openssl rand -base64 32
GOOGLE_CLIENT_ID="..."                      # Google Cloud Console
GOOGLE_CLIENT_SECRET="..."

# ── PhonePe v1 (UAT) ──────────────────────────────────────
PHONEPE_MERCHANT_ID="PGTESTPAYUAT86"        # Public UAT merchant
PHONEPE_MERCHANT_KEY="96434309-..."         # Salt key for X-VERIFY
PHONEPE_KEY_INDEX="1"
PHONEPE_ENV="SANDBOX"                       # SANDBOX | PRODUCTION
NEXT_PUBLIC_APP_URL="https://tunnel.trycloudflare.com"  # Public URL for webhooks

# ── Supabase ──────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."     # Safe to expose (RLS enforced)
SUPABASE_SERVICE_ROLE_KEY="eyJ..."         # Server-only — never in NEXT_PUBLIC_*

# ── Email ─────────────────────────────────────────────────
GMAIL_USER="president@gmail.com"
GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"   # Google App Password (not login password)

# ── Rate Limiting ─────────────────────────────────────────
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
```
