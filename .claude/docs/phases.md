# Build Phases

## Phase Order

| Phase | Feature Area | Status |
|-------|-------------|--------|
| 1 | Foundation: Auth, Users, Units, Roles | ✅ Complete |
| 2 | Maintenance Issue Tracker | ✅ Complete |
| 3 | Expenses, Balance Sheet & Reports | ✅ Complete |
| 4 | Payments (PhonePe UPI) | ✅ Complete |
| 5 | Announcements, Notifications & Document Vault | ✅ Complete |

---

## Phase 1 — Foundation: Auth, Users, Units, Roles ✅

**Goal**: Working app skeleton with authentication and role-based access

### Features
- Next.js project scaffold with Tailwind + shadcn/ui
- Supabase PostgreSQL database + Prisma schema + initial migrations
- Google OAuth login via NextAuth.js v5 (Gmail sign-in for all users)
- Role model: `SUPER_ADMIN`, `PRESIDENT`, `RESIDENT`
- Unit management: create/edit 12 units with flat numbers, block, floor
- Resident onboarding: President invites residents → they log in with Google → assigned to a unit
- President role transfer: Super Admin reassigns `PRESIDENT` role with full audit trail
- Role-based middleware: protect routes and API endpoints by role
- Dashboard shell: separate layouts for President and Resident

### Deliverables
- `/app/(auth)/` — login page with Google sign-in button
- `/app/(dashboard)/president/` — president dashboard shell
- `/app/(dashboard)/resident/` — resident dashboard shell
- `/app/api/users/` — user management endpoints
- `/app/api/units/` — unit CRUD endpoints
- Prisma schema with all tables and enums (full schema)
- Middleware with role-based route protection

---

## Phase 2 — Maintenance Issue Tracker ✅

**Goal**: Residents report issues; President manages resolution lifecycle

### Features
- Residents submit issues with title, description, category, photos (up to 3 images)
- Categories: Electrical, Plumbing, Lift, Common Area, Security, Cleaning, Other
- Priority levels: Low, Medium, High, Critical
- Status workflow: `OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED`
- President assigns issues to a vendor or internal person (free-text assignee name)
- Comment thread on each issue (both President and Resident can comment)
- Auto-escalation flag: issues unresolved beyond 7 days get highlighted
- Resident can reopen a resolved issue within 48 hours
- Issue list views:
  - Resident: sees their own issues + status
  - President: sees all issues, filterable by status/category/priority
- Email notification to resident on status change

### Deliverables
- `/app/(dashboard)/resident/issues/` — raise and track issues
- `/app/(dashboard)/resident/issues/new/` — new issue form
- `/app/(dashboard)/resident/issues/[id]/` — issue detail + comments
- `/app/(dashboard)/president/issues/` — manage all issues with filters
- `/app/(dashboard)/president/issues/[id]/` — issue detail + assign + status update
- `/app/api/issues/` — CRUD + status transition endpoints
- `/app/api/issues/[id]/comments/` — comment endpoints
- Supabase Storage bucket for issue photos

---

## Phase 3 — Expenses, Balance Sheet & Reports ✅

**Goal**: Full financial transparency with meaningful reports and PDF exports

### Features
- Expense recording by President:
  - Amount, date, category, vendor name, description
  - Attach receipt photo (Supabase Storage)
  - Categories: Repairs, Utilities, Salaries, Cleaning, Security, AMC, Miscellaneous
- Running fund balance = total collected − total spent (visible to all residents)
- **Reports** (viewable in-app + exportable as PDF):
  - Monthly collection report: unit-wise payment status for any month
  - Dues ledger: per-resident outstanding across all months
  - Expense breakdown: category-wise spend for a period
  - Fund utilization: income vs expenses over time (chart)
  - Issue resolution stats: avg resolution time, open count, category breakdown
  - Year-end financial summary: total collected, total spent, closing balance
- President can add one-time special levies (e.g., painting fund)

### Deliverables
- `/app/(dashboard)/president/expenses/` — expense management
- `/app/(dashboard)/reports/` — reports (shared route, content filtered by role)
- `/app/api/reports/` — report data endpoints
- `/app/api/expenses/` — expense CRUD
- `expenses` Prisma table (already in schema)

---

## Phase 4 — Maintenance Fees & PhonePe Payments ✅

**Goal**: Residents can pay monthly maintenance online; president tracks all dues

### Features
- Fee schedule: President defines monthly fee per unit (can differ by unit size/type)
- Auto-generate monthly fee records for all 12 units
- Payment dashboard for President: collected vs outstanding per month
- Resident payment page: shows current due, past payments, pending balance
- **PhonePe UPI integration**:
  - Initiate payment from app → redirect to PhonePe checkout
  - Webhook receives confirmation → verify SHA-256 signature → update status
  - Handle failures, timeouts, and duplicate callbacks safely
- Late fee configuration: auto-apply late fee after configurable due date
- PDF receipt generation on successful payment (React-PDF)
- Email receipt to resident after payment (Nodemailer + Gmail SMTP)
- Outstanding dues report for President

### Deliverables
- `/app/api/payments/initiate` — create PhonePe order
- `/app/api/webhooks/phonepe` — secure webhook handler
- `/app/(dashboard)/resident/pay` — resident payment page
- `/app/(dashboard)/president/fees` — fee management + dues overview
- `fee_schedules`, `payments` Prisma tables (already in schema)

---

## Phase 5 — Announcements, Notifications & Document Vault ✅

**Goal**: Communication tools and document storage to complete the platform

### Features
- **Announcements**:
  - President posts notices (title, body, optional attachment)
  - All residents see announcements on their dashboard
  - Email notification to all residents on new announcement
- **Document Vault**:
  - President uploads documents: meeting minutes, audit reports, maintenance contracts, invoices
  - All residents can view/download (read-only)
  - Categories: Meeting Minutes, Financial Audit, Maintenance Contract, Other
- **Notifications** (email via Nodemailer + Gmail SMTP):
  - Payment due reminder (sent 3 days before due date via cron)
  - Overdue payment reminder (sent on due date + every 7 days until paid)
  - Issue status change alert to resident
  - New announcement alert to all residents
- **Dashboard enhancements**:
  - Resident home: balance summary, open issues count, latest announcements
  - President home: collection rate this month, open issues, recent expenses, fund balance

### Deliverables
- `/app/(dashboard)/president/announcements/` — create announcements
- `/app/(dashboard)/resident/announcements/` — view announcements
- `/app/(dashboard)/documents/` — document vault
- `/app/api/announcements/` — announcement endpoints
- `/app/api/documents/` — document upload/list
- Vercel Cron Job for payment reminders
- `announcements`, `documents` Prisma tables (already in schema)

---

## Phase Order Rationale

Phases are ordered by value delivered and dependency order:
1. Nothing works without auth and users (Phase 1)
2. Issue tracking is immediate value, no payment dependency (Phase 2)
3. Expenses and reports provide financial visibility without payment integration (Phase 3)
4. PhonePe payment integration — isolated, complex, saved for last major feature (Phase 4)
5. Communication and polish complete the experience (Phase 5)
