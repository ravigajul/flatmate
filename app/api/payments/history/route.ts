import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isPresidentOrAdmin =
    session.user.role === 'PRESIDENT' || session.user.role === 'SUPER_ADMIN'

  const where = isPresidentOrAdmin
    ? {}
    : {
        feeSchedule: {
          unitId: session.user.unitId ?? '__none__',
        },
      }

  const payments = await prisma.payment.findMany({
    where,
    include: {
      feeSchedule: {
        select: { monthYear: true, amount: true },
      },
      unit: {
        select: { flatNumber: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(payments)
}
