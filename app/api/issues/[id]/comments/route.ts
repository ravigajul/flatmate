import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { NextResponse } from 'next/server'

const createCommentSchema = z.object({
  text: z.string().min(1).max(1000),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: issueId } = await params

  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { id: true, raisedById: true },
  })

  if (!issue) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
  }

  const isPrivileged =
    session.user.role === 'PRESIDENT' || session.user.role === 'SUPER_ADMIN'

  if (!isPrivileged && issue.raisedById !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createCommentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const comment = await prisma.issueComment.create({
    data: {
      issueId,
      authorId: session.user.id,
      text: parsed.data.text,
    },
    include: {
      author: { select: { name: true, role: true } },
    },
  })

  return NextResponse.json(comment, { status: 201 })
}
