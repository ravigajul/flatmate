import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/utils'
import { IndianRupee, Wrench, Megaphone, ArrowRight, CheckCircle2, Clock } from 'lucide-react'
import Link from 'next/link'

export default async function ResidentDashboard() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const currentMonth = new Date().toISOString().slice(0, 7)

  const [openIssues, currentDue, recentAnnouncements] = await Promise.all([
    prisma.issue.count({
      where: { raisedById: session.user.id, status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } },
    }),
    session.user.unitId
      ? prisma.feeSchedule.findFirst({
          where: { unitId: session.user.unitId, monthYear: currentMonth },
          include: { payments: { where: { status: 'SUCCESS' }, select: { id: true } } },
        })
      : null,
    prisma.announcement.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, body: true, createdAt: true },
    }),
  ])

  const isPaid = (currentDue?.payments.length ?? 0) > 0

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Hello, {session.user.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-slate-500 text-sm mt-1">Here&apos;s a summary of your account</p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
        {/* Fee status */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <IndianRupee className="w-5 h-5 text-indigo-600" />
            </div>
            {currentDue && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                isPaid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}>
                {isPaid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                {isPaid ? 'Paid' : 'Due'}
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {currentDue ? formatCurrency(currentDue.amount) : '—'}
          </p>
          <p className="text-sm text-slate-500 mt-0.5">This month&apos;s maintenance</p>
          {!isPaid && currentDue && (
            <Link
              href="/resident/pay"
              className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Pay Now <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        {/* Issues status */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{openIssues}</p>
          <p className="text-sm text-slate-500 mt-0.5">Open maintenance issues</p>
          <Link
            href="/resident/issues/new"
            className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-xl border border-slate-200 transition-colors"
          >
            Raise an Issue <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Announcements */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">Announcements</h2>
          </div>
          <Link href="/resident/announcements" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
            View all
          </Link>
        </div>
        {recentAnnouncements.length === 0 ? (
          <div className="px-6 py-10 text-center text-slate-400 text-sm">No announcements yet</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentAnnouncements.map((a) => (
              <li key={a.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                <p className="text-sm font-medium text-slate-800">{a.title}</p>
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{a.body}</p>
                <p className="text-xs text-slate-300 mt-1">
                  {new Date(a.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
