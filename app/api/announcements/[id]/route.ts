import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { NextResponse } from 'next/server'

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

  const existing = await prisma.announcement.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })

  await prisma.announcement.delete({ where: { id } })

  await writeAuditLog({
    userId: session.user.id,
    action: 'ANNOUNCEMENT_DELETED',
    entity: 'Announcement',
    entityId: id,
    metadata: { title: existing.title },
  })

  return NextResponse.json({ success: true })
}
