import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { NextResponse } from 'next/server'

const updateFeeScheduleSchema = z.object({
  amount: z.number().positive().optional(),
  lateFee: z.number().min(0).optional(),
  dueDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'PRESIDENT' && session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const existing = await prisma.feeSchedule.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Fee schedule not found' }, { status: 404 })

  const body = await request.json()
  const parsed = updateFeeScheduleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const updated = await prisma.feeSchedule.update({
    where: { id },
    data: {
      ...(parsed.data.amount !== undefined && { amount: parsed.data.amount }),
      ...(parsed.data.lateFee !== undefined && { lateFee: parsed.data.lateFee }),
      ...(parsed.data.dueDate !== undefined && { dueDate: parsed.data.dueDate }),
    },
    include: {
      unit: { select: { flatNumber: true, ownerName: true } },
    },
  })

  return NextResponse.json(updated)
}
