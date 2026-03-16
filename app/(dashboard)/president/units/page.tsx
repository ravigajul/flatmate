import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import UnitsClient from './units-client'

export default async function UnitsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'PRESIDENT' && session.user.role !== 'SUPER_ADMIN') {
    redirect('/resident')
  }

  const units = await prisma.unit.findMany({
    orderBy: { flatNumber: 'asc' },
    include: {
      residents: {
        where: { isActive: true },
        select: { id: true, name: true, email: true },
      },
    },
  })

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Units</h1>
          <p className="text-slate-500 text-sm mt-1">{units.length} units configured</p>
        </div>
      </div>
      <UnitsClient units={units} />
    </div>
  )
}
