import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Megaphone, Plus } from 'lucide-react'

export default async function AnnouncementsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'PRESIDENT' && session.user.role !== 'SUPER_ADMIN') redirect('/resident')

  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, body: true, createdAt: true },
  })

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Announcements</h1>
          <p className="text-slate-500 text-sm mt-1">{announcements.length} announcements posted</p>
        </div>
        <button
          disabled
          title="Coming soon"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl opacity-50 cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          New Announcement
        </button>
      </div>

      {announcements.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-16 text-center">
          <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No announcements yet</p>
          <p className="text-slate-400 text-sm mt-1">Post an announcement to notify all residents</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <div key={a.id} className="bg-white rounded-2xl border border-slate-200 shadow-card p-6">
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <Megaphone className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{a.title}</p>
                  <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{a.body}</p>
                  <p className="text-xs text-slate-400 mt-3">
                    {new Date(a.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
