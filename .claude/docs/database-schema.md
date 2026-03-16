# Database Schema

Full Prisma schema for the Apartment Maintenance Management App.

## Enums

```prisma
enum Role {
  SUPER_ADMIN
  PRESIDENT
  RESIDENT
}

enum IssueStatus {
  OPEN
  ASSIGNED
  IN_PROGRESS
  RESOLVED
  CLOSED
}

enum IssuePriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum IssueCategory {
  ELECTRICAL
  PLUMBING
  LIFT
  COMMON_AREA
  SECURITY
  CLEANING
  OTHER
}

enum PaymentStatus {
  PENDING
  SUCCESS
  FAILED
  REFUNDED
}

enum ExpenseCategory {
  REPAIRS
  UTILITIES
  SALARIES
  CLEANING
  SECURITY
  AMC           // Annual Maintenance Contract
  MISCELLANEOUS
}

enum DocumentCategory {
  MEETING_MINUTES
  FINANCIAL_AUDIT
  MAINTENANCE_CONTRACT
  INVOICE
  OTHER
}
```

## Tables

### users
Stores all app users. One user per Google account. A unit can have up to 2 residents (owner + tenant).

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String
  phone         String?
  image         String?
  role          Role      @default(RESIDENT)
  unitId        String?
  unit          Unit?     @relation(fields: [unitId], references: [id])
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  issues        Issue[]
  issueComments IssueComment[]
  announcements Announcement[]
  documents     Document[]
  auditLogs     AuditLog[]
  expenses      Expense[]

  @@index([email])
  @@index([unitId])
}
```

### units
Represents each of the 12 flats.

```prisma
model Unit {
  id            String    @id @default(cuid())
  flatNumber    String    @unique   // e.g. "A101", "B204"
  block         String?             // e.g. "A", "B"
  floor         Int
  areaSqft      Float?
  ownerName     String?             // For reference; may differ from resident
  isOccupied    Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  residents     User[]
  feeSchedules  FeeSchedule[]
  payments      Payment[]
  issues        Issue[]

  @@index([flatNumber])
}
```

### fee_schedules
Monthly fee definition per unit. President creates these for each billing month.

```prisma
model FeeSchedule {
  id            String    @id @default(cuid())
  unitId        String
  unit          Unit      @relation(fields: [unitId], references: [id])
  amount        Float                           // Base maintenance amount in INR
  lateFee       Float     @default(0)           // Extra charge if paid after dueDate
  monthYear     String                          // Format: "2025-03" (YYYY-MM)
  dueDate       DateTime
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  payments      Payment[]

  @@unique([unitId, monthYear])
  @@index([monthYear])
}
```

### payments
Records each payment attempt and outcome.

```prisma
model Payment {
  id                String        @id @default(cuid())
  unitId            String
  unit              Unit          @relation(fields: [unitId], references: [id])
  feeScheduleId     String
  feeSchedule       FeeSchedule   @relation(fields: [feeScheduleId], references: [id])
  amount            Float
  lateFeeApplied    Float         @default(0)
  status            PaymentStatus @default(PENDING)
  phonePeTxnId      String?       @unique     // PhonePe transaction ID
  phonePeMerchantOrderId String   @unique     // Our internal order ID sent to PhonePe
  paymentMethod     String?                   // "UPI", "PHONEPE_WALLET", etc.
  paidAt            DateTime?
  failureReason     String?
  receiptUrl        String?                   // PDF receipt stored in Supabase
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  @@index([unitId])
  @@index([status])
  @@index([phonePeTxnId])
}
```

### expenses
All outgoing expenses recorded by the President.

```prisma
model Expense {
  id            String          @id @default(cuid())
  amount        Float
  category      ExpenseCategory
  vendor        String?
  description   String
  receiptUrl    String?         // Image uploaded to Supabase Storage
  expenseDate   DateTime
  addedById     String
  addedBy       User            @relation(fields: [addedById], references: [id])
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  @@index([category])
  @@index([expenseDate])
}
```

### issues
Maintenance issues raised by residents.

```prisma
model Issue {
  id            String        @id @default(cuid())
  unitId        String
  unit          Unit          @relation(fields: [unitId], references: [id])
  raisedById    String
  raisedBy      User          @relation(fields: [raisedById], references: [id])
  title         String
  description   String
  category      IssueCategory
  priority      IssuePriority @default(MEDIUM)
  status        IssueStatus   @default(OPEN)
  assignedTo    String?       // Vendor or person name (free text)
  photoUrls     String[]      // Up to 3 images in Supabase Storage
  resolvedAt    DateTime?
  closedAt      DateTime?
  isEscalated   Boolean       @default(false)  // Auto-set if unresolved > 7 days
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  // Relations
  comments      IssueComment[]

  @@index([status])
  @@index([unitId])
  @@index([category])
}
```

### issue_comments
Threaded comments on issues (both resident and president can comment).

```prisma
model IssueComment {
  id        String   @id @default(cuid())
  issueId   String
  issue     Issue    @relation(fields: [issueId], references: [id], onDelete: Cascade)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  text      String
  createdAt DateTime @default(now())

  @@index([issueId])
}
```

### announcements
Notices posted by the President visible to all residents.

```prisma
model Announcement {
  id           String   @id @default(cuid())
  title        String
  body         String
  attachmentUrl String?
  postedById   String
  postedBy     User     @relation(fields: [postedById], references: [id])
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([createdAt])
}
```

### documents
Document vault — PDFs, images uploaded for transparency.

```prisma
model Document {
  id           String           @id @default(cuid())
  name         String
  url          String           // Supabase Storage URL
  category     DocumentCategory
  fileSize     Int?             // in bytes
  uploadedById String
  uploadedBy   User             @relation(fields: [uploadedById], references: [id])
  createdAt    DateTime         @default(now())

  @@index([category])
}
```

### audit_logs
Immutable record of all financial and role-change actions. Append-only — never update or delete.

```prisma
model AuditLog {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  action     String   // e.g. "PAYMENT_SUCCESS", "EXPENSE_CREATED", "ROLE_CHANGED"
  entity     String   // e.g. "Payment", "Expense", "User"
  entityId   String
  metadata   Json?    // Extra context (amount, old role → new role, etc.)
  ipAddress  String?
  createdAt  DateTime @default(now())

  @@index([userId])
  @@index([entity, entityId])
  @@index([action])
  @@index([createdAt])
}
```

## Key Relations Summary

```
Unit (1) ──── (many) User          [residents in a flat]
Unit (1) ──── (many) FeeSchedule   [monthly fees per unit]
Unit (1) ──── (many) Payment       [all payments for a unit]
Unit (1) ──── (many) Issue         [issues from a unit]
FeeSchedule (1) ── (many) Payment  [payments against a schedule]
Issue (1) ──── (many) IssueComment [thread on an issue]
User (1) ──── (many) AuditLog      [who did what]
```

## Notes

- `monthYear` format is `"YYYY-MM"` (e.g. `"2025-03"`) for easy sorting and grouping
- `Payment.phonePeMerchantOrderId` is generated by us (cuid-based), must be stored before calling PhonePe API
- `AuditLog` is append-only — no application code should ever call `update` or `delete` on this table; enforce via Supabase RLS
- `Issue.isEscalated` is set by a Vercel Cron job that runs nightly
- `photoUrls` stored as `String[]` — Postgres native array, up to 3 URLs per issue
