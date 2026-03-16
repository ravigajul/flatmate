import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AnnouncementManager from './announcement-manager'

export default async function PresidentAnnouncementsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'PRESIDENT' && session.user.role !== 'SUPER_ADMIN') {
    redirect('/resident')
  }

  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      postedBy: { select: { name: true } },
    },
  })

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Announcements</h1>
          <p className="text-slate-500 text-sm mt-1">
            {announcements.length} announcement{announcements.length !== 1 ? 's' : ''} posted
          </p>
        </div>
      </div>

      <AnnouncementManager
        announcements={announcements.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
