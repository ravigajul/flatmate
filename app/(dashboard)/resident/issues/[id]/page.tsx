import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import CommentForm from './comment-form'

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

export default async function ResidentIssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { id } = await params

  const issue = await prisma.issue.findUnique({
    where: { id },
    include: {
      unit: { select: { flatNumber: true } },
      raisedBy: { select: { name: true, email: true } },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { name: true, role: true } },
        },
      },
    },
  })

  if (!issue) notFound()

  // Residents can only view their own issues
  if (
    session.user.role === 'RESIDENT' &&
    issue.raisedById !== session.user.id
  ) {
    redirect('/resident/issues')
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/resident/issues"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        My Issues
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 leading-snug">{issue.title}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant={statusVariant[issue.status] ?? 'muted'}>
              {statusLabel[issue.status] ?? issue.status}
            </Badge>
            <Badge variant={priorityVariant[issue.priority] ?? 'default'}>
              {priorityLabel[issue.priority] ?? issue.priority} Priority
            </Badge>
          </div>
        </div>
      </div>

      {/* Escalation warning */}
      {issue.isEscalated && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl mb-6 text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <p className="text-sm font-medium">This issue has been escalated</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {/* Metadata card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Issue Details</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">Category</dt>
              <dd className="text-slate-800">{categoryLabel[issue.category] ?? issue.category}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">Unit</dt>
              <dd className="text-slate-800">Flat {issue.unit.flatNumber}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">Raised On</dt>
              <dd className="text-slate-800">
                {new Date(issue.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </dd>
            </div>
            {issue.assignedTo && (
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">Assigned To</dt>
                <dd className="text-slate-800">{issue.assignedTo}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Description card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Description</h2>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {issue.description}
          </p>
          {issue.photoUrls.length > 0 && (
            <div className="mt-4 flex gap-3 flex-wrap">
              {issue.photoUrls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={url}
                    alt={`Photo ${i + 1}`}
                    className="w-28 h-28 object-cover rounded-xl border border-slate-200 hover:opacity-90 transition-opacity"
                  />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Comments card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <MessageSquare className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700">
              Comments
              {issue.comments.length > 0 && (
                <span className="ml-1.5 text-slate-400 font-normal">({issue.comments.length})</span>
              )}
            </h2>
          </div>

          {issue.comments.length === 0 ? (
            <p className="text-sm text-slate-400 mb-5">No comments yet.</p>
          ) : (
            <div className="space-y-4 mb-6">
              {issue.comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-indigo-700">
                      {(comment.author.name ?? 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium text-slate-800">
                        {comment.author.name ?? 'Unknown'}
                      </span>
                      <Badge variant={comment.author.role === 'PRESIDENT' || comment.author.role === 'SUPER_ADMIN' ? 'info' : 'muted'}>
                        {comment.author.role === 'PRESIDENT' || comment.author.role === 'SUPER_ADMIN' ? 'President' : 'Resident'}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {new Date(comment.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{comment.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-slate-100 pt-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Add Comment</h3>
            <CommentForm issueId={id} />
          </div>
        </div>
      </div>
    </div>
  )
}
