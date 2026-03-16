import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { sendReceiptEmail } from '@/lib/email'
import { createHash, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function verifySignature(base64Response: string, xVerifyHeader: string): boolean {
  const saltKey = process.env.PHONEPE_MERCHANT_KEY
  const saltIndex = process.env.PHONEPE_KEY_INDEX ?? '1'
  if (!saltKey) return false

  try {
    const hash = createHash('sha256')
      .update(base64Response + saltKey)
      .digest('hex')
    const expected = `${hash}###${saltIndex}`

    const a = Buffer.from(xVerifyHeader)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const xVerifyHeader = request.headers.get('X-VERIFY') ?? ''

  let body: { response?: string }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const base64Response = body.response ?? ''

  if (!verifySignature(base64Response, xVerifyHeader)) {
    console.warn('[PhonePe webhook] Invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let data: {
    merchantId: string
    merchantTransactionId: string
    transactionId?: string
    amount: number
    state: string
    responseCode?: string
    paymentInstrument?: { type: string }
  }

  try {
    data = JSON.parse(Buffer.from(base64Response, 'base64').toString('utf-8'))
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { merchantTransactionId: merchantOrderId, state, transactionId, responseCode } = data

  const payment = await prisma.payment.findUnique({
    where: { phonePeMerchantOrderId: merchantOrderId },
    include: {
      feeSchedule: { select: { monthYear: true } },
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

  const systemUserId = await prisma.user
    .findFirst({ where: { unitId: payment.unitId }, select: { id: true } })
    .then((u) => u?.id ?? payment.unitId)

  if (state === 'COMPLETED') {
    const paidAt = new Date()
    const amountInINR = (data.amount ?? 0) / 100

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCESS',
        phonePeTxnId: transactionId ?? null,
        paidAt,
        paymentMethod: data.paymentInstrument?.type ?? null,
      },
    })

    await writeAuditLog({
      userId: systemUserId,
      action: 'PAYMENT_SUCCESS',
      entity: 'Payment',
      entityId: payment.id,
      metadata: { merchantOrderId, transactionId, amount: amountInINR },
    })

    const resident = payment.unit.residents[0]
    if (resident?.email) {
      await sendReceiptEmail({
        to: resident.email,
        residentName: resident.name ?? 'Resident',
        amount: amountInINR,
        monthYear: payment.feeSchedule.monthYear,
        transactionId: transactionId ?? merchantOrderId,
      }).catch((err) => {
        console.error('[PhonePe webhook] Failed to send receipt email:', err)
      })
    }
  } else if (state === 'FAILED') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        failureReason: responseCode ?? 'Payment failed',
      },
    })

    await writeAuditLog({
      userId: systemUserId,
      action: 'PAYMENT_FAILED',
      entity: 'Payment',
      entityId: payment.id,
      metadata: { merchantOrderId, responseCode },
    })
  }

  return NextResponse.json({ success: true })
}
