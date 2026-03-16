import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Building2, Users, Wrench, IndianRupee, ArrowRight, TrendingUp, Megaphone, Receipt } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'

export default async function PresidentDashboard() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'PRESIDENT' && session.user.role !== 'SUPER_ADMIN') {
    redirect('/resident')
  }

  const currentMonth = new Date().toISOString().slice(0, 7)

  const [totalUnits, totalResidents, openIssues, pendingUsers, collectionStats, recentExpenses, latestAnnouncement] = await Promise.all([
    prisma.unit.count(),
    prisma.user.count({ where: { role: 'RESIDENT', isActive: true } }),
    prisma.issue.count({ where: { status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } } }),
    prisma.user.count({ where: { isActive: false, role: 'RESIDENT' } }),
    prisma.payment.aggregate({
      where: {
        status: 'SUCCESS',
        feeSchedule: { monthYear: currentMonth },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.expense.findMany({
      take: 3,
      orderBy: { expenseDate: 'desc' },
      select: { id: true, description: true, amount: true, expenseDate: true, category: true },
    }),
    prisma.announcement.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, createdAt: true },
    }),
  ])

  const stats = [
    {
      label: 'Total Units',
      value: totalUnits,
      icon: Building2,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      href: '/president/units',
    },
    {
      label: 'Active Residents',
      value: totalResidents,
      icon: Users,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      href: '/president/users',
    },
    {
      label: 'Open Issues',
      value: openIssues,
      icon: Wrench,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      href: '/president/issues',
    },
    {
      label: 'Collected This Month',
      value: formatCurrency(collectionStats._sum.amount ?? 0),
      icon: IndianRupee,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
      href: '/president/fees',
      isText: true,
    },
  ]

  const quickActions = [
    { href: '/president/units', label: 'Manage Units', desc: 'Add and configure flat units', icon: Building2 },
    { href: '/president/users', label: 'Manage Residents', desc: `${pendingUsers} pending activation`, icon: Users, badge: pendingUsers > 0 ? pendingUsers : undefined },
    { href: '/president/fees', label: 'Fee Schedules', desc: 'Set monthly maintenance fees', icon: IndianRupee },
    { href: '/president/issues', label: 'Issue Tracker', desc: `${openIssues} open issues`, icon: Wrench, badge: openIssues > 0 ? openIssues : undefined },
  ]

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          Welcome back, {session.user.name?.split(' ')[0]}. Here&apos;s what&apos;s happening.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card hover:shadow-card-hover transition-shadow group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {stat.isText ? stat.value : stat.value.toLocaleString('en-IN')}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">{stat.label}</p>
          </Link>
        ))}
      </div>

      {/* Recent expenses + latest announcement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Recent expenses */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-slate-400" />
              <h2 className="font-semibold text-slate-900">Recent Expenses</h2>
            </div>
            <Link href="/president/expenses" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              View all
            </Link>
          </div>
          {recentExpenses.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">No expenses recorded</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentExpenses.map((e) => (
                <li key={e.id} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{e.description}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(e.expenseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-rose-600 ml-4 flex-shrink-0">
                    {'₹' + e.amount.toLocaleString('en-IN')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Latest announcement */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-slate-400" />
              <h2 className="font-semibold text-slate-900">Latest Announcement</h2>
            </div>
            <Link href="/president/announcements" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              Manage
            </Link>
          </div>
          {latestAnnouncement ? (
            <div className="px-6 py-4">
              <p className="text-sm font-medium text-slate-800">{latestAnnouncement.title}</p>
              <p className="text-xs text-slate-400 mt-1">
                {new Date(latestAnnouncement.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
          ) : (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">No announcements posted</div>
          )}
        </div>
      </div>

      {/* Quick actions + collection progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick actions */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-card">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Quick Actions</h2>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group"
              >
                <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center flex-shrink-0 transition-colors">
                  <action.icon className="w-4 h-4 text-slate-600 group-hover:text-indigo-600 transition-colors" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800">{action.label}</p>
                    {action.badge && (
                      <span className="bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                        {action.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{action.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 flex-shrink-0 transition-colors" />
              </Link>
            ))}
          </div>
        </div>

        {/* Collection summary */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">This Month</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">
                  {collectionStats._count} / {totalUnits}
                </p>
                <p className="text-xs text-slate-500">units paid</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-2 mb-3">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all"
                style={{ width: `${totalUnits > 0 ? (collectionStats._count / totalUnits) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              {totalUnits > 0
                ? `${Math.round((collectionStats._count / totalUnits) * 100)}% collection rate`
                : 'No fee schedules set'}
            </p>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500">Amount collected</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">
                {formatCurrency(collectionStats._sum.amount ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
