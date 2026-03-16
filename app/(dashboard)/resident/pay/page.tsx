import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CreditCard, Construction } from 'lucide-react'

export default async function PayPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Pay Fees</h1>
        <p className="text-slate-500 text-sm mt-1">Pay your monthly maintenance fee via UPI</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-16 text-center">
        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CreditCard className="w-7 h-7 text-indigo-400" />
        </div>
        <div className="flex items-center justify-center gap-2 mb-2">
          <Construction className="w-4 h-4 text-amber-500" />
          <p className="text-slate-700 font-semibold">Coming in Phase 2</p>
        </div>
        <p className="text-slate-400 text-sm max-w-sm mx-auto">
          PhonePe UPI payment integration will be available in the next phase. You&apos;ll be able to pay and download receipts here.
        </p>
      </div>
    </div>
  )
}
