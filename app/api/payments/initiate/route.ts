import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { initiatePayment } from '@/lib/phonepe'
import { z } from 'zod'
import { NextResponse } from 'next/server'

const initiatePaymentSchema = z.object({
  feeScheduleId: z.string().min(1),
})

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'RESIDENT') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!session.user.unitId) {
    return NextResponse.json({ error: 'No unit assigned to your account' }, { status: 400 })
  }

  const body = await request.json()
  const parsed = initiatePaymentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { feeScheduleId } = parsed.data

  // Find the fee schedule
  const feeSchedule = await prisma.feeSchedule.findUnique({
    where: { id: feeScheduleId },
  })

  if (!feeSchedule) {
    return NextResponse.json({ error: 'Fee schedule not found' }, { status: 404 })
  }

  // Security check: fee schedule must belong to the resident's unit
  if (feeSchedule.unitId !== session.user.unitId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Check if already paid
  const existingPayment = await prisma.payment.findFirst({
    where: {
      feeScheduleId,
      status: 'SUCCESS',
    },
  })

  if (existingPayment) {
    return NextResponse.json({ error: 'Already paid' }, { status: 409 })
  }

  // Calculate amount (add late fee if past due date)
  const isLate = new Date() > feeSchedule.dueDate
  const lateFeeApplied = isLate ? feeSchedule.lateFee : 0
  const totalAmount = feeSchedule.amount + lateFeeApplied

  // Generate unique merchant order ID
  const merchantOrderId = 'flatmate-' + crypto.randomUUID()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const redirectUrl = `${appUrl}/resident/pay/callback`

  // Create Payment record first (PENDING)
  const payment = await prisma.payment.create({
    data: {
      unitId: session.user.unitId,
      feeScheduleId,
      amount: feeSchedule.amount,
      lateFeeApplied,
      status: 'PENDING',
      phonePeMerchantOrderId: merchantOrderId,
    },
  })

  // Write audit log
  await writeAuditLog({
    userId: session.user.id,
    action: 'PAYMENT_INITIATED',
    entity: 'Payment',
    entityId: payment.id,
    metadata: { merchantOrderId, amount: totalAmount, feeScheduleId },
  })

  // Call PhonePe to initiate payment
  const phonePeRedirectUrl = await initiatePayment({
    merchantOrderId,
    amountPaise: Math.round(totalAmount * 100),
    redirectUrl,
  })

  return NextResponse.json({ redirectUrl: phonePeRedirectUrl, paymentId: payment.id })
}
