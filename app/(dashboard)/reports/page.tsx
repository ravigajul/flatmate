import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Suspense } from 'react'
import CollectionTable from './collection-table'

function formatINR(amount: number) {
  return '₹' + amount.toLocaleString('en-IN')
}

const CATEGORY_LABELS: Record<string, string> = {
  REPAIRS: 'Repairs',
  UTILITIES: 'Utilities',
  SALARIES: 'Salaries',
  CLEANING: 'Cleaning',
  SECURITY: 'Security',
  AMC: 'AMC',
  MISCELLANEOUS: 'Miscellaneous',
}

export default async function ReportsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const isPrivileged =
    session.user.role === 'PRESIDENT' || session.user.role === 'SUPER_ADMIN'

  const [
    paymentAggregate,
    expenseAggregate,
    expensesByCategory,
    allIssues,
    recentExpenses,
  ] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: 'SUCCESS' },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ['category'],
      _sum: { amount: true },
    }),
    prisma.issue.findMany({
      select: {
        status: true,
        createdAt: true,
        resolvedAt: true,
      },
    }),
    prisma.expense.findMany({
      select: {
        id: true,
        amount: true,
        category: true,
        description: true,
        expenseDate: true,
      },
      orderBy: { expenseDate: 'desc' },
      take: 5,
    }),
  ])

  const totalCollected = paymentAggregate._sum.amount ?? 0
  const totalExpenses = expenseAggregate._sum.amount ?? 0
  const balance = totalCollected - totalExpenses

  const expensesByCategoryMap: Record<string, number> = {}
  for (const row of expensesByCategory) {
    expensesByCategoryMap[row.category] = row._sum.amount ?? 0
  }

  const open = allIssues.filter((i) => i.status === 'OPEN').length
  const resolved = allIssues.filter(
    (i) => i.status === 'RESOLVED' || i.status === 'CLOSED'
  ).length
  const total = allIssues.length

  const resolvedIssues = allIssues.filter(
    (i) => (i.status === 'RESOLVED' || i.status === 'CLOSED') && i.resolvedAt
  )
  let avgResolutionDays = 0
  if (resolvedIssues.length > 0) {
    const totalDays = resolvedIssues.reduce((sum, i) => {
      const days =
        (new Date(i.resolvedAt!).getTime() - new Date(i.createdAt).getTime()) /
        (1000 * 60 * 60 * 24)
      return sum + days
    }, 0)
    avgResolutionDays = Math.round((totalDays / resolvedIssues.length) * 10) / 10
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-slate-500 text-sm mt-1">Financial overview and collection summaries</p>
      </div>

      {/* Fund Balance */}
      <section>
        <h2 className="text-base font-semibold text-slate-700 mb-4">Fund Balance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">
              Total Collected
            </p>
            <p className="text-2xl font-bold text-emerald-600">{formatINR(totalCollected)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">
              Total Expenses
            </p>
            <p className="text-2xl font-bold text-rose-600">{formatINR(totalExpenses)}</p>
          </div>
          <div
            className={`rounded-2xl border shadow-card p-6 ${
              balance >= 0
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">
              Balance
            </p>
            <p
              className={`text-2xl font-bold ${
                balance >= 0 ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {formatINR(balance)}
            </p>
          </div>
        </div>
      </section>

      {/* Expense Breakdown */}
      {totalExpenses > 0 && (
        <section>
          <h2 className="text-base font-semibold text-slate-700 mb-4">Expense Breakdown</h2>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-4">
            {Object.entries(expensesByCategoryMap)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, amount]) => {
                const pct = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700">
                        {CATEGORY_LABELS[cat] ?? cat}
                      </span>
                      <span className="text-sm text-slate-600">
                        {formatINR(amount)}{' '}
                        <span className="text-slate-400 text-xs">
                          ({pct.toFixed(1)}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </section>
      )}

      {/* Issue Stats */}
      <section>
        <h2 className="text-base font-semibold text-slate-700 mb-4">Issue Statistics</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Issues', value: total, color: 'text-slate-900' },
            { label: 'Open', value: open, color: 'text-amber-600' },
            { label: 'Resolved', value: resolved, color: 'text-emerald-600' },
            {
              label: 'Avg Resolution',
              value: `${avgResolutionDays}d`,
              color: 'text-sky-600',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-2xl border border-slate-200 shadow-card p-5"
            >
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">
                {stat.label}
              </p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Expenses */}
      {recentExpenses.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-slate-700 mb-4">Recent Expenses</h2>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Date
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Category
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Description
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentExpenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {new Date(e.expenseDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {CATEGORY_LABELS[e.category] ?? e.category}
                    </td>
                    <td className="px-6 py-4 text-slate-700">{e.description}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {formatINR(e.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Monthly Collection (president only) */}
      {isPrivileged && (
        <section>
          <h2 className="text-base font-semibold text-slate-700 mb-4">Monthly Collection</h2>
          <Suspense fallback={null}>
            <CollectionTable />
          </Suspense>
        </section>
      )}
    </div>
  )
}
