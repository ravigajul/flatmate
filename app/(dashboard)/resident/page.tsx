import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/utils'

export default async function ResidentDashboard() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const currentMonth = new Date().toISOString().slice(0, 7) // "YYYY-MM"

  const [openIssues, currentDue, recentAnnouncements] = await Promise.all([
    prisma.issue.count({
      where: {
        raisedById: session.user.id,
        status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
      },
    }),
    session.user.unitId
      ? prisma.feeSchedule.findFirst({
          where: { unitId: session.user.unitId, monthYear: currentMonth },
          include: {
            payments: {
              where: { status: 'SUCCESS' },
              select: { id: true },
            },
          },
        })
      : null,
    prisma.announcement.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, createdAt: true },
    }),
  ])

  const isPaid = currentDue?.payments && currentDue.payments.length > 0

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Welcome, {session.user.name?.split(' ')[0]}
      </h1>
      <p className="text-gray-500 text-sm mb-6">
        Unit: {session.user.unitId ? 'Assigned' : 'Not assigned yet'}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm text-gray-500">This Month&apos;s Maintenance</p>
          {currentDue ? (
            <div className="mt-1">
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(currentDue.amount)}
              </p>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full mt-2 inline-block ${
                  isPaid
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {isPaid ? 'Paid' : 'Due'}
              </span>
            </div>
          ) : (
            <p className="text-gray-400 text-sm mt-2">No fee schedule set</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm text-gray-500">Open Issues</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{openIssues}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Recent Announcements</h2>
          {recentAnnouncements.length === 0 ? (
            <p className="text-gray-400 text-sm">No announcements yet</p>
          ) : (
            <ul className="space-y-3">
              {recentAnnouncements.map((a) => (
                <li key={a.id}>
                  <a
                    href="/resident/announcements"
                    className="text-sm font-medium text-gray-800 hover:text-blue-600"
                  >
                    {a.title}
                  </a>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(a.createdAt).toLocaleDateString('en-IN')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <a
            href="/resident/pay"
            className="block bg-blue-600 text-white rounded-xl p-4 hover:bg-blue-700 transition-colors"
          >
            <p className="font-semibold">Pay Maintenance Fee</p>
            <p className="text-sm text-blue-100 mt-0.5">Pay via PhonePe / UPI</p>
          </a>
          <a
            href="/resident/issues/new"
            className="block bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow"
          >
            <p className="font-semibold text-gray-900">Raise an Issue</p>
            <p className="text-sm text-gray-500 mt-0.5">Report a maintenance problem</p>
          </a>
        </div>
      </div>
    </div>
  )
}
