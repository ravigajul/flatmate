import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import type { IssueCategory, IssuePriority, IssueStatus } from '@prisma/client'

const createIssueSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(2000),
  category: z.enum([
    'ELECTRICAL',
    'PLUMBING',
    'LIFT',
    'COMMON_AREA',
    'SECURITY',
    'CLEANING',
    'OTHER',
  ]),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  photoUrls: z.array(z.string()).max(3).default([]),
})

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') as IssueStatus | null
  const category = searchParams.get('category') as IssueCategory | null
  const priority = searchParams.get('priority') as IssuePriority | null

  const isPrivileged =
    session.user.role === 'PRESIDENT' || session.user.role === 'SUPER_ADMIN'

  const where: Record<string, unknown> = {}

  if (!isPrivileged) {
    where.raisedById = session.user.id
  }

  if (status) where.status = status
  if (category) where.category = category
  if (priority) where.priority = priority

  const issues = await prisma.issue.findMany({
    where,
    include: {
      unit: { select: { flatNumber: true } },
      raisedBy: { select: { name: true, email: true } },
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(issues)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!session.user.unitId) {
    return NextResponse.json(
      { error: 'You must be assigned to a unit before raising an issue' },
      { status: 403 }
    )
  }

  const body = await request.json()
  const parsed = createIssueSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const issue = await prisma.issue.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category as IssueCategory,
      priority: parsed.data.priority as IssuePriority,
      photoUrls: parsed.data.photoUrls,
      unitId: session.user.unitId,
      raisedById: session.user.id,
    },
    include: {
      unit: { select: { flatNumber: true } },
      raisedBy: { select: { name: true, email: true } },
      _count: { select: { comments: true } },
    },
  })

  return NextResponse.json(issue, { status: 201 })
}
