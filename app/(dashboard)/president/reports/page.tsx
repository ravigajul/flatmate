import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { FileBarChart2, Construction } from 'lucide-react'

export default async function ReportsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'PRESIDENT' && session.user.role !== 'SUPER_ADMIN') redirect('/resident')

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-slate-500 text-sm mt-1">Financial reports and collection summaries</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-16 text-center">
        <div className="w-14 h-14 bg-sky-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <FileBarChart2 className="w-7 h-7 text-sky-400" />
        </div>
        <div className="flex items-center justify-center gap-2 mb-2">
          <Construction className="w-4 h-4 text-amber-500" />
          <p className="text-slate-700 font-semibold">Coming in Phase 4</p>
        </div>
        <p className="text-slate-400 text-sm max-w-sm mx-auto">
          Monthly collection reports, expense summaries, and PDF export will be available in Phase 4.
        </p>
      </div>
    </div>
  )
}
