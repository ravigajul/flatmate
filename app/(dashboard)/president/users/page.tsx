import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import UsersClient from './users-client'

export default async function ResidentsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'PRESIDENT' && session.user.role !== 'SUPER_ADMIN') {
    redirect('/resident')
  }

  const [users, units] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ isActive: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        unitId: true,
        isActive: true,
        createdAt: true,
        image: true,
        unit: { select: { flatNumber: true } },
      },
    }),
    prisma.unit.findMany({
      orderBy: { flatNumber: 'asc' },
      select: { id: true, flatNumber: true, block: true },
    }),
  ])

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Residents</h1>
        <p className="text-slate-500 text-sm mt-1">
          {users.filter((u) => u.isActive).length} active ·{' '}
          {users.filter((u) => !u.isActive).length} pending activation
        </p>
      </div>
      <UsersClient users={users} units={units} currentUserId={session.user.id} isSuperAdmin={session.user.role === 'SUPER_ADMIN'} />
    </div>
  )
}
