import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { IndianRupee, Construction } from 'lucide-react'

export default async function FeesPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'PRESIDENT' && session.user.role !== 'SUPER_ADMIN') redirect('/resident')

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Fee Schedules</h1>
        <p className="text-slate-500 text-sm mt-1">Manage monthly maintenance fee schedules</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-16 text-center">
        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <IndianRupee className="w-7 h-7 text-indigo-400" />
        </div>
        <div className="flex items-center justify-center gap-2 mb-2">
          <Construction className="w-4 h-4 text-amber-500" />
          <p className="text-slate-700 font-semibold">Coming in Phase 2</p>
        </div>
        <p className="text-slate-400 text-sm max-w-sm mx-auto">
          Fee schedules, PhonePe UPI payments, and receipt generation will be available in the next phase.
        </p>
      </div>
    </div>
  )
}
