import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { getClientIp } from '@/lib/utils'
import { z } from 'zod'
import { NextResponse } from 'next/server'

const updateUserSchema = z.object({
  unitId: z.string().cuid().nullable().optional(),
  isActive: z.boolean().optional(),
  role: z.enum(['RESIDENT', 'PRESIDENT', 'SUPER_ADMIN']).optional(),
  phone: z.string().max(15).optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isPresident = session.user.role === 'PRESIDENT' || session.user.role === 'SUPER_ADMIN'
  if (!isPresident) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Only SUPER_ADMIN can change roles
  const body = await request.json()
  if (body.role && session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Only Super Admin can change roles' }, { status: 403 })
  }

  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { id } = await params
  const prevUser = await prisma.user.findUnique({ where: { id } })
  if (!prevUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const updated = await prisma.user.update({
    where: { id },
    data: parsed.data,
  })

  // Audit role changes
  if (parsed.data.role && parsed.data.role !== prevUser.role) {
    await writeAuditLog({
      userId: session.user.id,
      action: 'ROLE_CHANGED',
      entity: 'User',
      entityId: id,
      metadata: { from: prevUser.role, to: parsed.data.role },
      ipAddress: getClientIp(request),
    })
  }

  return NextResponse.json(updated)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Only Super Admin can delete users' }, { status: 403 })

  const { id } = await params
  if (id === session.user.id) return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  await prisma.user.delete({ where: { id } })

  await writeAuditLog({
    userId: session.user.id,
    action: 'USER_DELETED',
    entity: 'User',
    entityId: id,
    metadata: { email: user.email, role: user.role },
    ipAddress: getClientIp(request),
  })

  return NextResponse.json({ success: true })
}
