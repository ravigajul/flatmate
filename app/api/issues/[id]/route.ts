import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import type { IssueStatus } from '@prisma/client'
import { sendStatusChangeEmail } from '@/lib/email'

const presidentUpdateSchema = z.object({
  status: z
    .enum(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])
    .optional(),
  assignedTo: z.string().nullable().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
})

const residentUpdateSchema = z.object({
  reopen: z.literal(true),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const issue = await prisma.issue.findUnique({
    where: { id },
    include: {
      unit: { select: { flatNumber: true } },
      raisedBy: { select: { name: true, email: true } },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { name: true, role: true } },
        },
      },
    },
  })

  if (!issue) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
  }

  const isPrivileged =
    session.user.role === 'PRESIDENT' || session.user.role === 'SUPER_ADMIN'

  if (!isPrivileged && issue.raisedById !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(issue)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'PRESIDENT' && session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const issue = await prisma.issue.findUnique({ where: { id } })
  if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 })

  // IssueComment rows cascade automatically (onDelete: Cascade in schema)
  await prisma.issue.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const issue = await prisma.issue.findUnique({
    where: { id },
    include: {
      raisedBy: { select: { name: true, email: true } },
    },
  })

  if (!issue) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
  }

  const isPrivileged =
    session.user.role === 'PRESIDENT' || session.user.role === 'SUPER_ADMIN'

  const body = await request.json()

  if (isPrivileged) {
    const parsed = presidentUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { status, assignedTo, priority } = parsed.data

    const updateData: Record<string, unknown> = {}
    if (status !== undefined) updateData.status = status
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo
    if (priority !== undefined) updateData.priority = priority

    if (status === 'RESOLVED') {
      updateData.resolvedAt = new Date()
    } else if (status === 'CLOSED') {
      updateData.closedAt = new Date()
    }

    const updatedIssue = await prisma.issue.update({
      where: { id },
      data: updateData,
    })

    if (status && status !== issue.status) {
      try {
        await sendStatusChangeEmail({
          to: issue.raisedBy.email,
          residentName: issue.raisedBy.name ?? 'Resident',
          issueTitle: issue.title,
          newStatus: status,
          issueId: id,
        })
      } catch {
        // Swallow email errors — notification is best-effort
      }
    }

    return NextResponse.json(updatedIssue)
  }

  // Resident path: only allowed to reopen within 48h of resolution
  if (issue.raisedById !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = residentUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (issue.status !== 'RESOLVED') {
    return NextResponse.json(
      { error: 'You can only reopen a resolved issue' },
      { status: 422 }
    )
  }

  if (!issue.resolvedAt) {
    return NextResponse.json(
      { error: 'Issue has no resolved timestamp' },
      { status: 422 }
    )
  }

  const hoursSinceResolution =
    (Date.now() - issue.resolvedAt.getTime()) / (1000 * 60 * 60)

  if (hoursSinceResolution > 48) {
    return NextResponse.json(
      { error: 'Reopen window has expired (48 hours after resolution)' },
      { status: 422 }
    )
  }

  const updatedIssue = await prisma.issue.update({
    where: { id },
    data: { status: 'OPEN' as IssueStatus, resolvedAt: null },
  })

  try {
    await sendStatusChangeEmail({
      to: issue.raisedBy.email,
      residentName: issue.raisedBy.name ?? 'Resident',
      issueTitle: issue.title,
      newStatus: 'OPEN',
      issueId: id,
    })
  } catch {
    // Swallow email errors — notification is best-effort
  }

  return NextResponse.json(updatedIssue)
}
