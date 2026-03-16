import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { sendReceiptEmail } from '@/lib/email'
import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function verifySignature(rawBody: string, authHeader: string, sigHeader: string): boolean {
  const webhookSecret = process.env.PHONEPE_WEBHOOK_SECRET
  if (!webhookSecret) return false

  // Primary: check Authorization header matches webhook secret directly
  if (authHeader === webhookSecret) {
    return true
  }

  // Fallback: check HMAC signature
  if (sigHeader) {
    try {
      const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('base64')
      const sigBuf = Buffer.from(sigHeader)
      const expectedBuf = Buffer.from(expected)
      if (sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)) {
        return true
      }
    } catch {
      // invalid base64 or other error
    }
  }

  return false
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const authHeader = request.headers.get('Authorization') ?? ''
  const sigHeader = request.headers.get('X-PHONEPE-SIGNATURE') ?? ''

  if (!verifySignature(rawBody, authHeader, sigHeader)) {
    console.warn('[PhonePe webhook] Invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let payload: {
    type: string
    payload: {
      merchantOrderId: string
      orderId: string
      state: string
      amount: number
      errorCode?: string
      payments?: Array<{
        transactionId: string
        paymentMode: string
        amount: number
        state: string
      }>
    }
  }

  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { type, payload: data } = payload
  const { merchantOrderId, state } = data
  const firstPayment = data.payments?.[0]

  // Find payment by merchantOrderId
  const payment = await prisma.payment.findUnique({
    where: { phonePeMerchantOrderId: merchantOrderId },
    include: {
      feeSchedule: {
        select: {
          monthYear: true,
        },
      },
      unit: {
        include: {
          residents: {
            select: { email: true, name: true },
            take: 1,
          },
        },
      },
    },
  })

  // Unknown merchantOrderId — ignore gracefully
  if (!payment) {
    return NextResponse.json({ success: true })
  }

  // Idempotency: already processed
  if (payment.status === 'SUCCESS') {
    return NextResponse.json({ success: true })
  }

  if (type === 'checkout.order.completed' && state === 'COMPLETED') {
    const paidAt = new Date()
    const amountInINR = (data.amount ?? 0) / 100

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCESS',
        phonePeTxnId: firstPayment?.transactionId ?? null,
        paidAt,
        paymentMethod: firstPayment?.paymentMode ?? null,
      },
    })

    // Find system user for audit log (use a placeholder if needed)
    const systemUserId = payment.unit.residents[0]
      ? await prisma.user
          .findFirst({ where: { unitId: payment.unitId }, select: { id: true } })
          .then((u) => u?.id ?? payment.unitId)
      : payment.unitId

    await writeAuditLog({
      userId: systemUserId,
      action: 'PAYMENT_SUCCESS',
      entity: 'Payment',
      entityId: payment.id,
      metadata: {
        merchantOrderId,
        transactionId: firstPayment?.transactionId,
        amount: amountInINR,
      },
    })

    // Send receipt email
    const resident = payment.unit.residents[0]
    if (resident?.email) {
      await sendReceiptEmail({
        to: resident.email,
        residentName: resident.name ?? 'Resident',
        amount: amountInINR,
        monthYear: payment.feeSchedule.monthYear,
        transactionId: firstPayment?.transactionId ?? merchantOrderId,
      }).catch((err) => {
        console.error('[PhonePe webhook] Failed to send receipt email:', err)
      })
    }
  } else if (type === 'checkout.order.failed' || state === 'FAILED') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        failureReason: data.errorCode ?? 'Payment failed',
      },
    })

    const systemUserId = await prisma.user
      .findFirst({ where: { unitId: payment.unitId }, select: { id: true } })
      .then((u) => u?.id ?? payment.unitId)

    await writeAuditLog({
      userId: systemUserId,
      action: 'PAYMENT_FAILED',
      entity: 'Payment',
      entityId: payment.id,
      metadata: {
        merchantOrderId,
        errorCode: data.errorCode,
      },
    })
  }

  return NextResponse.json({ success: true })
}
