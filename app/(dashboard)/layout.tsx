import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (!session.user.isActive) redirect('/pending')

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar user={session.user} />
      {/* Content offset by sidebar width */}
      <div className="pl-64">
        <main className="min-h-screen p-8">{children}</main>
      </div>
    </div>
  )
}
