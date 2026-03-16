import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { NextResponse } from 'next/server'

const updateUnitSchema = z.object({
  flatNumber: z.string().min(1).max(20).optional(),
  block: z.string().max(10).optional(),
  floor: z.number().int().min(0).max(50).optional(),
  areaSqft: z.number().positive().optional(),
  ownerName: z.string().max(100).optional(),
  isOccupied: z.boolean().optional(),
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
  const body = await request.json()
  const parsed = updateUnitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const unit = await prisma.unit.update({
    where: { id },
    data: parsed.data,
  })
  return NextResponse.json(unit)
}
