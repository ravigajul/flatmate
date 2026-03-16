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

  const existing = await prisma.document.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  await prisma.document.delete({ where: { id } })

  await writeAuditLog({
    userId: session.user.id,
    action: 'DOCUMENT_DELETED',
    entity: 'Document',
    entityId: id,
    metadata: { name: existing.name, category: existing.category },
  })

  return NextResponse.json({ success: true })
}
