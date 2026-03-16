# Security

## Threat Model

This app handles real financial transactions and personal data for apartment residents in India. The key threats are:

- Unauthorized access to another resident's payment data
- Payment tampering or replay attacks via PhonePe webhook
- Privilege escalation (resident acting as president)
- Data exposure through insecure APIs
- Brute force login attempts

---

## Authentication

**Provider**: Google OAuth via NextAuth.js v5

- Residents and President log in with their Gmail account (no passwords stored)
- NextAuth issues a signed JWT stored in an httpOnly cookie (not accessible to JavaScript)
- JWT contains: `{ id, email, role, unitId }`
- Session expiry: 30 days (sliding window)
- On every request, `middleware.ts` verifies the JWT before routing

**New User Flow**:
- First Google login creates a `RESIDENT` account
- Account is inactive until President assigns them to a unit
- Inactive users see a "pending approval" screen and cannot access any data

---

## Role-Based Access Control (RBAC)

### Middleware (First Line of Defense)
`middleware.ts` runs on every request before any page or API route:

```
/president/* routes  → require PRESIDENT or SUPER_ADMIN role
/resident/*  routes  → require RESIDENT, PRESIDENT, or SUPER_ADMIN role
/api/*       routes  → require valid session (role checked per endpoint)
/api/webhooks/phonepe → no session required (signature-verified instead)
```

### API Route Guards (Second Line of Defense)
Every API handler calls `getServerSession()` and checks role before any DB operation:

```typescript
const session = await getServerSession(authOptions)
if (!session || session.user.role !== 'PRESIDENT') {
  return Response.json({ error: 'Forbidden' }, { status: 403 })
}
```

### Supabase Row Level Security (Third Line of Defense)
RLS policies on the database as a safety net:

- `users`: Users can only read their own row; President reads all
- `payments`: Users read only payments for their own unit
- `issues`: Users read only their own issues; President reads all
- `audit_logs`: Read-only for President; no user can delete/update
- `expenses`: Read-only for Residents (transparency); President can write

---

## Payment Security

### PhonePe Webhook Verification
The `/api/webhooks/phonepe` endpoint must never trust incoming data without verifying the signature:

```
1. Extract X-VERIFY header from PhonePe request
2. Decode base64 response body
3. Compute SHA-256(base64_encoded_body + "/callback" + merchantKey)
4. Append "###" + keyIndex
5. Compare computed hash with X-VERIFY header (constant-time comparison)
6. If mismatch → return 400, log suspicious request
7. If match → process payment update
```

### Idempotency
- PhonePe may send the same webhook multiple times
- Before updating payment status, check if `phonePeTxnId` already exists and status is already `SUCCESS`
- If already processed → return 200 (acknowledge) but do not double-credit

### Order ID Generation
- `phonePeMerchantOrderId` is generated using `cuid()` before calling PhonePe API
- Stored in DB as `PENDING` before redirect
- Ensures we can always reconcile payment even if webhook is delayed

---

## Input Validation

All API endpoints validate inputs using **Zod** before any DB operation:

```typescript
const createIssueSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().min(10).max(1000),
  category: z.nativeEnum(IssueCategory),
  priority: z.nativeEnum(IssuePriority),
})
```

- Reject requests with unexpected fields (`.strict()` mode)
- Sanitize string inputs to prevent XSS
- Validate file uploads: type (images only for photos), size (max 5MB per file)

---

## Rate Limiting

Using Upstash Redis (free tier) via `@upstash/ratelimit`:

| Endpoint | Limit |
|----------|-------|
| `POST /api/auth/*` | 10 requests / 15 minutes per IP |
| `POST /api/payments/initiate` | 5 requests / 10 minutes per user |
| `POST /api/issues` | 10 requests / 1 hour per user |
| `POST /api/webhooks/phonepe` | 100 requests / 1 minute (PhonePe IPs only) |

---

## HTTP Security Headers

Set via `next.config.js` for all responses:

```
Content-Security-Policy: default-src 'self'; img-src 'self' data: https://*.supabase.co; connect-src 'self' https://api.phonepe.com
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=63072000; includeSubDomains
```

---

## Audit Logging

Every financial and role-sensitive action writes to `audit_logs`:

| Action | Trigger |
|--------|---------|
| `PAYMENT_INITIATED` | Resident starts payment |
| `PAYMENT_SUCCESS` | PhonePe webhook confirms payment |
| `PAYMENT_FAILED` | PhonePe webhook reports failure |
| `EXPENSE_CREATED` | President adds expense |
| `EXPENSE_UPDATED` | President edits expense |
| `EXPENSE_DELETED` | President deletes expense |
| `ROLE_CHANGED` | Super Admin changes a user's role |
| `FEE_SCHEDULE_CREATED` | President creates fee schedule |
| `ISSUE_STATUS_CHANGED` | Any status transition on an issue |

**Audit log rules**:
- Immutable: no `UPDATE` or `DELETE` operations in application code
- Supabase RLS: `DENY UPDATE, DELETE ON audit_logs FOR ALL`
- Store IP address on all financial actions
- Store `metadata` JSON with before/after values for changes

---

## File Upload Security

For issue photos and expense receipts (Supabase Storage):

- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp` (no PDFs for photos)
- Max file size: 5MB per file
- Max 3 photos per issue
- Files stored in private Supabase buckets — accessed via signed URLs (expire in 1 hour)
- Document vault (PDFs): max 20MB, signed URLs expire in 24 hours
- File names are replaced with UUID to prevent path traversal

---

## Environment & Secrets

- All secrets in `.env.local` (never committed — `.gitignore` includes it)
- Vercel environment variables used in production (not `.env` files)
- `NEXTAUTH_SECRET`: minimum 32 random bytes (generate with `openssl rand -base64 32`)
- `PHONEPE_MERCHANT_KEY`: kept server-side only, never in `NEXT_PUBLIC_*` variables
- `SUPABASE_SERVICE_ROLE_KEY`: server-side only, never exposed to browser
