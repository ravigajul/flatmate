import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { NextResponse } from 'next/server'

const createUnitSchema = z.object({
  flatNumber: z.string().min(1).max(20),
  block: z.string().max(10).optional(),
  floor: z.number().int().min(0).max(50),
  areaSqft: z.number().positive().optional(),
  ownerName: z.string().max(100).optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const units = await prisma.unit.findMany({
    orderBy: { flatNumber: 'asc' },
    include: {
      residents: {
        select: { id: true, name: true, email: true, role: true, isActive: true },
      },
    },
  })

  return NextResponse.json(units)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'PRESIDENT' && session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createUnitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const unit = await prisma.unit.create({ data: parsed.data })
  return NextResponse.json(unit, { status: 201 })
}
