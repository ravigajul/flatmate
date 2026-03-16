import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  return { other: { refresh: '5;url=/resident/pay/callback' } }
}

function PendingState() {
  return (
    <div className="max-w-lg mx-auto mt-12">
      <div className="bg-white rounded-2xl border border-amber-200 shadow-card p-8 text-center">
        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-amber-700 mb-2">Payment Processing...</h1>
        <p className="text-slate-600 mb-4">
          Your payment is being processed. This page will refresh automatically.
        </p>
        <p className="text-slate-400 text-sm mb-6">
          Check back in a few minutes if this page does not update.
        </p>
        <Link
          href="/resident/pay"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors"
        >
          Back to Payments
        </Link>
      </div>
    </div>
  )
}

export default async function PayCallbackPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  if (!session.user.unitId) {
    redirect('/resident/pay')
  }

  // Find the most recent payment for this unit created in the last 5 minutes
  const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000)

  const payment = await prisma.payment.findFirst({
    where: {
      unitId: session.user.unitId,
      createdAt: { gte: fiveMinsAgo },
    },
    include: {
      feeSchedule: {
        select: { monthYear: true, amount: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!payment) {
    // No recent payment found — redirect to pay page
    redirect('/resident/pay')
  }

  const formatINR = (amount: number) => '₹' + amount.toLocaleString('en-IN')

  if (payment.status === 'SUCCESS') {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-card p-8 text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-emerald-700 mb-2">Payment Successful!</h1>
          <p className="text-slate-600 mb-6">
            Your maintenance fee for <strong>{payment.feeSchedule.monthYear}</strong> has been paid.
          </p>
          <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Amount</span>
              <span className="font-semibold text-slate-900">
                {formatINR((payment.amount ?? 0) + (payment.lateFeeApplied ?? 0))}
              </span>
            </div>
            {payment.phonePeTxnId && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Transaction ID</span>
                <span className="font-mono text-xs text-slate-700">{payment.phonePeTxnId}</span>
              </div>
            )}
          </div>
          <Link
            href="/resident/pay"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Back to Payments
          </Link>
        </div>
      </div>
    )
  }

  if (payment.status === 'FAILED') {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <div className="bg-white rounded-2xl border border-red-200 shadow-card p-8 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-red-700 mb-2">Payment Failed</h1>
          <p className="text-slate-600 mb-6">
            Your payment could not be processed. Please try again.
          </p>
          {payment.failureReason && (
            <p className="text-sm text-red-500 mb-4">{payment.failureReason}</p>
          )}
          <Link
            href="/resident/pay"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Try Again
          </Link>
        </div>
      </div>
    )
  }

  // PENDING — auto-refresh every 5 seconds via Next.js metadata
  return <PendingState />
}
