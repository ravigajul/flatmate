# PhonePe Payment Gateway Integration

## Overview

PhonePe Payment Gateway (PG) is used for collecting monthly maintenance fees online via UPI. The SDK is open source (Apache 2.0). There are no monthly fees — only a per-transaction MDR of ~1.5-2% for UPI payments.

**SDK**: `phonepe-pg-node` (official PhonePe Node.js SDK)
**Docs**: https://developer.phonepe.com/v1/docs/pay-page-integration

---

## Merchant Account Setup

1. Register at https://business.phonepe.com as a merchant
2. Complete KYC (business PAN, bank account)
3. Get sandbox credentials from the PhonePe merchant dashboard:
   - `PHONEPE_MERCHANT_ID`
   - `PHONEPE_MERCHANT_KEY`
   - `PHONEPE_KEY_INDEX` (usually `1`)
4. Configure webhook URL in merchant dashboard:
   - Sandbox: `https://<your-vercel-preview>.vercel.app/api/webhooks/phonepe`
   - Production: `https://<your-domain>/api/webhooks/phonepe`

---

## SDK Installation

```bash
npm install phonepe-pg-node
```

---

## Environment Config

```bash
# .env.local
PHONEPE_MERCHANT_ID=PGTESTPAYUAT     # Sandbox merchant ID
PHONEPE_MERCHANT_KEY=099eb0cd-02cf-4e2a-8aca-3e6c6aff0399  # Sandbox key
PHONEPE_KEY_INDEX=1
PHONEPE_ENV=SANDBOX                  # Change to PRODUCTION for live
PHONEPE_REDIRECT_URL=http://localhost:3000/resident/pay/callback
PHONEPE_CALLBACK_URL=http://localhost:3000/api/webhooks/phonepe
```

---

## Payment Initiation (`/api/payments/initiate`)

Called when a resident clicks "Pay Now".

```typescript
// lib/phonepe.ts
import { PhonePeGateway, Env } from 'phonepe-pg-node'

const gateway = new PhonePeGateway(
  process.env.PHONEPE_MERCHANT_ID!,
  process.env.PHONEPE_MERCHANT_KEY!,
  parseInt(process.env.PHONEPE_KEY_INDEX!),
  process.env.PHONEPE_ENV === 'PRODUCTION' ? Env.PRODUCTION : Env.SANDBOX
)

export async function initiatePayment({
  orderId,        // Our cuid-based merchant order ID
  amountPaise,    // Amount in paise (INR × 100)
  userPhone,
  redirectUrl,
  callbackUrl,
}: InitiatePaymentParams) {
  const response = await gateway.payWithPayPage({
    merchantOrderId: orderId,
    amount: amountPaise,
    mobileNumber: userPhone,
    redirectUrl,
    callbackUrl,
    paymentFlow: 'PG_REDIRECT',
  })
  return response.redirectUrl  // Redirect resident to this URL
}
```

**API Route flow**:

```
POST /api/payments/initiate
  Body: { feeScheduleId }

1. Validate session (RESIDENT role)
2. Fetch FeeSchedule, verify it belongs to session.user.unitId
3. Check if a SUCCESS payment already exists for this schedule → reject if so
4. Calculate total = baseFee + lateFee (if past due date)
5. Generate orderId = cuid()
6. Create Payment record { status: PENDING, phonePeMerchantOrderId: orderId }
7. Write AuditLog { action: PAYMENT_INITIATED }
8. Call initiatePayment() → get redirectUrl
9. Return { redirectUrl } to client
10. Client redirects: window.location.href = redirectUrl
```

---

## Webhook Handler (`/api/webhooks/phonepe`)

PhonePe POSTs to this endpoint after every payment attempt.

```typescript
// app/api/webhooks/phonepe/route.ts
import { createHmac, timingSafeEqual } from 'crypto'

export async function POST(request: Request) {
  // 1. Get raw body and X-VERIFY header
  const body = await request.text()
  const xVerify = request.headers.get('X-VERIFY') ?? ''

  // 2. Verify signature
  const [receivedHash, keyIndex] = xVerify.split('###')
  const expectedHash = createHmac('sha256',
    process.env.PHONEPE_MERCHANT_KEY!
  ).update(body + '/callback').digest('hex')

  const isValid = timingSafeEqual(
    Buffer.from(receivedHash),
    Buffer.from(expectedHash)
  )
  if (!isValid) {
    // Log suspicious request with IP
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // 3. Decode and parse response
  const decoded = JSON.parse(Buffer.from(body, 'base64').toString())
  const { merchantOrderId, transactionId, state, errorCode } = decoded.data

  // 4. Find payment by merchantOrderId
  const payment = await prisma.payment.findUnique({
    where: { phonePeMerchantOrderId: merchantOrderId }
  })
  if (!payment) return Response.json({ ok: true }) // Unknown order, ignore

  // 5. Idempotency check
  if (payment.status === 'SUCCESS') return Response.json({ ok: true })

  // 6. Update payment status
  if (state === 'COMPLETED') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCESS',
        phonePeTxnId: transactionId,
        paidAt: new Date(),
        paymentMethod: decoded.data.paymentInstrument?.type,
      }
    })
    // 7. Write audit log + send receipt email
    await writeAuditLog('PAYMENT_SUCCESS', 'Payment', payment.id, { transactionId })
    await sendReceiptEmail(payment)
  } else {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED', failureReason: errorCode }
    })
    await writeAuditLog('PAYMENT_FAILED', 'Payment', payment.id, { errorCode })
  }

  return Response.json({ ok: true })
}
```

---

## Redirect Callback (`/resident/pay/callback`)

PhonePe also redirects the browser here after checkout. This is **not** authoritative — only the webhook is authoritative. This page just shows the user a status message.

```typescript
// app/(dashboard)/resident/pay/callback/page.tsx
// Read ?status= query param from PhonePe redirect
// Poll payment status from our DB (not PhonePe) to show accurate result
// Show: "Payment Successful", "Payment Failed", or "Payment Processing..."
```

---

## Refund Flow

PhonePe supports refunds via API. Refunds are initiated only by the President (e.g., duplicate payment):

```typescript
await gateway.refund({
  merchantOrderId: originalOrderId,
  merchantRefundId: newCuid(),
  amount: refundAmountPaise,
})
```

Update Payment status to `REFUNDED` and write `PAYMENT_REFUNDED` audit log.

---

## Sandbox Testing

PhonePe provides test credentials and a sandbox environment:

- **Sandbox Merchant ID**: `PGTESTPAYUAT`
- **Sandbox Key**: `099eb0cd-02cf-4e2a-8aca-3e6c6aff0399`
- Use any test UPI ID in sandbox (payments auto-succeed or fail based on test amounts)
- Sandbox webhooks are sent to your configured callback URL

**Test amounts**:
- Any amount ending in `00` → SUCCESS
- Any amount ending in `33` → FAILED
- Any amount ending in `77` → PENDING (timeout simulation)

---

## Going Live Checklist

- [ ] Complete PhonePe merchant KYC
- [ ] Switch `PHONEPE_ENV=PRODUCTION` in Vercel env vars
- [ ] Update webhook URL in PhonePe merchant dashboard to production domain
- [ ] Test one real payment end-to-end before announcing to residents
- [ ] Verify webhook signature verification works in production
- [ ] Set up PhonePe merchant dashboard alerts for failed payments
