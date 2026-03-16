import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Megaphone } from 'lucide-react'

export default async function ResidentAnnouncementsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, body: true, createdAt: true },
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
