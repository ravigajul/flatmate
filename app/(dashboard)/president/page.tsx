import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export default async function PresidentDashboard() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'PRESIDENT' && session.user.role !== 'SUPER_ADMIN') {
    redirect('/resident')
  }

  const [totalUnits, totalResidents, openIssues] = await Promise.all([
    prisma.unit.count(),
    prisma.user.count({ where: { role: 'RESIDENT', isActive: true } }),
    prisma.issue.count({ where: { status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } } }),
  ])

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">President Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Units" value={totalUnits} />
        <StatCard label="Active Residents" value={totalResidents} />
        <StatCard label="Open Issues" value={openIssues} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <QuickLink href="/president/units" title="Manage Units" description="Add, edit, and assign units to residents" />
        <QuickLink href="/president/users" title="Manage Residents" description="Invite and activate resident accounts" />
        <QuickLink href="/president/fees" title="Fee Schedules" description="Set monthly maintenance fees" />
        <QuickLink href="/president/issues" title="All Issues" description="View and manage maintenance issues" />
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  )
}

function QuickLink({
  href,
  title,
  description,
}: {
  href: string
  title: string
  description: string
}) {
  return (
    <a
      href={href}
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow block"
    >
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </a>
  )
}
