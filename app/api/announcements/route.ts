import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { sendAnnouncementEmail } from '@/lib/email'
import { z } from 'zod'
import { NextResponse } from 'next/server'

const createAnnouncementSchema = z.object({
  title: z.string().min(3).max(200),
  body: z.string().min(10).max(5000),
  attachmentUrl: z.string().url().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      postedBy: { select: { name: true } },
    },
  })

  return NextResponse.json(announcements)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'PRESIDENT' && session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createAnnouncementSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const announcement = await prisma.announcement.create({
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      attachmentUrl: parsed.data.attachmentUrl,
      postedById: session.user.id,
    },
    include: {
      postedBy: { select: { name: true } },
    },
  })

  await writeAuditLog({
    userId: session.user.id,
    action: 'ANNOUNCEMENT_CREATED',
    entity: 'Announcement',
    entityId: announcement.id,
    metadata: { title: announcement.title },
  })

  // Send email to all active residents
  const residents = await prisma.user.findMany({
    where: { isActive: true, role: 'RESIDENT' },
    select: { email: true },
  })

  const emails = residents.map((r) => r.email).filter(Boolean) as string[]
  if (emails.length > 0) {
    await sendAnnouncementEmail({
      to: emails,
      title: announcement.title,
      body: announcement.body,
    })
  }

  return NextResponse.json(announcement, { status: 201 })
}
