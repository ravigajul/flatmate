import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import FeeManager from './fee-manager'

export default async function FeesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'PRESIDENT' && session.user.role !== 'SUPER_ADMIN') {
    redirect('/resident')
  }

  const { month } = await searchParams
  const currentMonth = month ?? new Date().toISOString().slice(0, 7)

  const schedules = await prisma.feeSchedule.findMany({
    where: { monthYear: currentMonth },
    include: {
      unit: { select: { flatNumber: true, ownerName: true } },
      payments: {
        select: { id: true, status: true, paidAt: true, amount: true, phonePeTxnId: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { unit: { flatNumber: 'asc' } },
  })

  // Compute stats
  const totalDue = schedules.reduce((sum, s) => sum + s.amount, 0)
  const paidSchedules = schedules.filter((s) => s.payments[0]?.status === 'SUCCESS')
  const totalCollected = paidSchedules.reduce(
    (sum, s) => sum + (s.payments[0]?.amount ?? 0),
    0
  )
  const outstanding = totalDue - totalCollected
  const collectionRate = totalDue > 0 ? (totalCollected / totalDue) * 100 : 0

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fee Management</h1>
          <p className="text-slate-500 text-sm mt-1">Manage monthly maintenance fee schedules and collections</p>
        </div>
      </div>

      <FeeManager
        schedules={schedules.map((s) => ({
          ...s,
          dueDate: s.dueDate.toISOString(),
          payments: s.payments.map((p) => ({
            ...p,
            paidAt: p.paidAt?.toISOString() ?? null,
          })),
        }))}
        currentMonth={currentMonth}
        stats={{ totalDue, totalCollected, outstanding, collectionRate }}
      />
    </div>
  )
}
