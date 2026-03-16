import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') // Expected format: YYYY-MM

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: 'month query param is required in YYYY-MM format' },
      { status: 400 }
    )
  }

  const units = await prisma.unit.findMany({
    orderBy: { flatNumber: 'asc' },
    select: {
      id: true,
      flatNumber: true,
      ownerName: true,
      feeSchedules: {
        where: { monthYear: month },
        select: {
          id: true,
          amount: true,
          payments: {
            select: {
              id: true,
              status: true,
              paidAt: true,
            },
            take: 1,
          },
        },
        take: 1,
      },
    },
  })

  const result = units.map((unit) => {
    const feeSchedule = unit.feeSchedules[0] ?? null

    if (!feeSchedule) {
      return {
        unitId: unit.id,
        flatNumber: unit.flatNumber,
        ownerName: unit.ownerName ?? null,
        feeAmount: null,
        paymentStatus: 'NO_FEE' as const,
        paidAt: null,
      }
    }

    const payment = feeSchedule.payments[0] ?? null

    if (payment && payment.status === 'SUCCESS') {
      return {
        unitId: unit.id,
        flatNumber: unit.flatNumber,
        ownerName: unit.ownerName ?? null,
        feeAmount: feeSchedule.amount,
        paymentStatus: 'PAID' as const,
        paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
      }
    }

    return {
      unitId: unit.id,
      flatNumber: unit.flatNumber,
      ownerName: unit.ownerName ?? null,
      feeAmount: feeSchedule.amount,
      paymentStatus: 'PENDING' as const,
      paidAt: null,
    }
  })

  return NextResponse.json(result)
}
