import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { ClipboardList, AlertTriangle, ArrowRight, MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import IssueFilters from './issue-filters'
import IssueDeleteButton from './issue-delete-button'
import { Suspense } from 'react'
import type { IssueStatus, IssueCategory, IssuePriority } from '@prisma/client'

const statusVariant: Record<string, 'warning' | 'info' | 'success' | 'muted'> = {
  OPEN: 'warning',
  ASSIGNED: 'info',
  IN_PROGRESS: 'info',
  RESOLVED: 'success',
  CLOSED: 'muted',
}

const statusLabel: Record<string, string> = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}

const priorityVariant: Record<string, 'muted' | 'default' | 'warning' | 'danger'> = {
  LOW: 'muted',
  MEDIUM: 'default',
  HIGH: 'warning',
  CRITICAL: 'danger',
}

const priorityLabel: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
}

const categoryLabel: Record<string, string> = {
  ELECTRICAL: 'Electrical',
  PLUMBING: 'Plumbing',
  LIFT: 'Lift',
  COMMON_AREA: 'Common Area',
  SECURITY: 'Security',
  CLEANING: 'Cleaning',
  OTHER: 'Other',
}

const ESCALATION_DAYS = 7
const RESOLVED_STATUSES: IssueStatus[] = ['RESOLVED', 'CLOSED']

function computeIsEscalated(createdAt: Date, status: IssueStatus, dbEscalated: boolean): boolean {
  if (dbEscalated) return true
  if (RESOLVED_STATUSES.includes(status)) return false
  const daysSinceCreated = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  return daysSinceCreated > ESCALATION_DAYS
}

export default async function PresidentIssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; priority?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'PRESIDENT' && session.user.role !== 'SUPER_ADMIN') {
    redirect('/resident')
  }

  const { status, category, priority } = await searchParams

  const where: Record<string, unknown> = {}
  if (status) where.status = status as IssueStatus
  if (category) where.category = category as IssueCategory
  if (priority) where.priority = priority as IssuePriority

  const issues = await prisma.issue.findMany({
    where,
    include: {
      unit: { select: { flatNumber: true } },
      raisedBy: { select: { name: true } },
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Issue Tracker</h1>
            <Badge variant="default">{issues.length}</Badge>
          </div>
          <p className="text-slate-500 text-sm mt-1">View, assign, and resolve maintenance issues</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-6">
        <Suspense fallback={null}>
          <IssueFilters />
        </Suspense>
      </div>

      {issues.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-16 text-center">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No issues found</p>
          <p className="text-slate-400 text-sm mt-1">
            {status || category || priority
              ? 'Try adjusting your filters'
              : 'No maintenance issues have been raised yet'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Issue</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Raised By</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Priority</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Comments</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {issues.map((issue) => {
                const escalated = computeIsEscalated(issue.createdAt, issue.status, issue.isEscalated)
                return (
                  <tr key={issue.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {escalated && (
                          <span title="Escalated">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                          </span>
                        )}
                        <span className="font-medium text-slate-900 line-clamp-1">{issue.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{issue.unit.flatNumber}</td>
                    <td className="px-6 py-4 text-slate-600">{issue.raisedBy.name ?? '—'}</td>
                    <td className="px-6 py-4 text-slate-500">
                      {categoryLabel[issue.category] ?? issue.category}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={priorityVariant[issue.priority] ?? 'default'}>
                        {priorityLabel[issue.priority] ?? issue.priority}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={statusVariant[issue.status] ?? 'muted'}>
                        {statusLabel[issue.status] ?? issue.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-slate-500">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span className="text-xs">{issue._count.comments}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs">
                      {new Date(issue.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/president/issues/${issue.id}`}
                          className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 text-xs font-medium mr-1"
                        >
                          View <ArrowRight className="w-3 h-3" />
                        </Link>
                        <IssueDeleteButton issueId={issue.id} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
