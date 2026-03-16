import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Megaphone, Paperclip } from 'lucide-react'

export default async function ResidentAnnouncementsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      postedBy: { select: { name: true } },
    },
  })

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Announcements</h1>
        <p className="text-slate-500 text-sm mt-1">Updates from your apartment management</p>
      </div>

      {announcements.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-16 text-center">
          <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No announcements yet</p>
          <p className="text-slate-400 text-sm mt-1">Check back later for updates from your management</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <div key={a.id} className="bg-white rounded-2xl border border-slate-200 shadow-card p-6">
              <p className="font-semibold text-slate-900">{a.title}</p>
              <p className="text-xs text-slate-400 mt-1">
                {a.postedBy.name ?? 'Management'} &middot;{' '}
                {new Date(a.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
              <p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap">{a.body}</p>
              {a.attachmentUrl && (
                <a
                  href={a.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  Download Attachment
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
