import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { NextResponse } from 'next/server'

const generateFeesSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM format'),
  defaultAmount: z.number().positive(),
  lateFee: z.number().min(0).optional().default(0),
  dueDate: z.string().transform((s) => new Date(s)),
})

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'PRESIDENT' && session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')

  if (!month) {
    return NextResponse.json({ error: 'month query param is required (YYYY-MM)' }, { status: 400 })
  }

  const schedules = await prisma.feeSchedule.findMany({
    where: { monthYear: month },
    include: {
      unit: { select: { flatNumber: true, ownerName: true } },
      payments: {
        select: { id: true, status: true, paidAt: true, amount: true, phonePeTxnId: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { unit: { flatNumber: 'asc' } },
  })

  return NextResponse.json(schedules)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'PRESIDENT' && session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = generateFeesSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { month, defaultAmount, lateFee, dueDate } = parsed.data

  // Get all units
  const units = await prisma.unit.findMany({ select: { id: true } })

  // Get existing fee schedules for this month to skip
  const existing = await prisma.feeSchedule.findMany({
    where: { monthYear: month },
    select: { unitId: true },
  })
  const existingUnitIds = new Set(existing.map((e) => e.unitId))

  // Only create for units that don't already have a schedule
  const toCreate = units.filter((u) => !existingUnitIds.has(u.id))

  if (toCreate.length === 0) {
    return NextResponse.json({ created: 0, message: 'All units already have fee schedules for this month' }, { status: 201 })
  }

  const result = await prisma.feeSchedule.createMany({
    data: toCreate.map((unit) => ({
      unitId: unit.id,
      monthYear: month,
      amount: defaultAmount,
      lateFee: lateFee ?? 0,
      dueDate,
    })),
    skipDuplicates: true,
  })

  return NextResponse.json({ created: result.count }, { status: 201 })
}
