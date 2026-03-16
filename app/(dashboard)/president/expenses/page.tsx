import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import type { ExpenseCategory } from '@prisma/client'
import ExpenseManager from './expense-manager'

function formatINR(amount: number) {
  return '₹' + amount.toLocaleString('en-IN')
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; from?: string; to?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'PRESIDENT' && session.user.role !== 'SUPER_ADMIN') {
    redirect('/resident')
  }

  const { category, from, to } = await searchParams

  const where: Record<string, unknown> = {}
  if (category) where.category = category as ExpenseCategory
  if (from || to) {
    const dateFilter: Record<string, Date> = {}
    if (from) {
      const d = new Date(from)
      if (!isNaN(d.getTime())) dateFilter.gte = d
    }
    if (to) {
      const d = new Date(to)
      if (!isNaN(d.getTime())) dateFilter.lte = d
    }
    if (Object.keys(dateFilter).length > 0) where.expenseDate = dateFilter
  }

  const [expenses, totalAggregate] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: { addedBy: { select: { name: true } } },
      orderBy: { expenseDate: 'desc' },
    }),
    prisma.expense.aggregate({ _sum: { amount: true } }),
  ])

  const totalSpent = totalAggregate._sum.amount ?? 0

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
          <p className="text-slate-500 text-sm mt-1">Track apartment expenses and balance sheet</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Total Spent</p>
          <p className="text-2xl font-bold text-rose-600">{formatINR(totalSpent)}</p>
        </div>
      </div>

      <ExpenseManager
        expenses={expenses.map((e) => ({
          ...e,
          expenseDate: e.expenseDate.toISOString(),
        }))}
        initialFilters={{ category, from, to }}
      />
    </div>
  )
}
