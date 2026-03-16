import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { CreditCard, CheckCircle2 } from 'lucide-react'
import PayNowButton from './pay-now-button'
import type { PaymentStatus } from '@prisma/client'

function formatINR(amount: number) {
  return '₹' + amount.toLocaleString('en-IN')
}

function formatDate(date: Date | string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const statusVariant: Record<PaymentStatus, 'success' | 'warning' | 'danger' | 'muted'> = {
  SUCCESS: 'success',
  PENDING: 'warning',
  FAILED: 'danger',
  REFUNDED: 'muted',
}

const statusLabel: Record<PaymentStatus, string> = {
  SUCCESS: 'Paid',
  PENDING: 'Pending',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
}

export default async function PayPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  if (!session.user.unitId) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Pay Fees</h1>
          <p className="text-slate-500 text-sm mt-1">Pay your monthly maintenance fee via UPI</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-16 text-center">
          <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-700 font-semibold">No unit assigned</p>
          <p className="text-slate-400 text-sm max-w-sm mx-auto mt-1">
            Your account has not been assigned to a unit yet. Please contact the apartment president.
          </p>
        </div>
      </div>
    )
  }

  const currentMonth = new Date().toISOString().slice(0, 7)

  const [feeSchedule, recentPayments] = await Promise.all([
    prisma.feeSchedule.findUnique({
      where: {
        unitId_monthYear: {
          unitId: session.user.unitId,
          monthYear: currentMonth,
        },
      },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.payment.findMany({
      where: {
        unitId: session.user.unitId,
      },
      include: {
        feeSchedule: {
          select: { monthYear: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
  ])

  const latestPayment = feeSchedule?.payments[0] ?? null
  const isPaid = latestPayment?.status === 'SUCCESS'
  const isLate = feeSchedule ? new Date() > feeSchedule.dueDate : false
  const lateFeeApplied = isLate && feeSchedule ? feeSchedule.lateFee : 0
  const totalDue = feeSchedule ? feeSchedule.amount + lateFeeApplied : 0

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Pay Fees</h1>
        <p className="text-slate-500 text-sm mt-1">Pay your monthly maintenance fee via UPI</p>
      </div>

      {/* Current Due Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">Current Month</h2>
          <span className="text-sm text-slate-500">{currentMonth}</span>
        </div>

        {!feeSchedule ? (
          <div className="text-center py-8">
            <p className="text-slate-400 text-sm">No fee scheduled for this month</p>
          </div>
        ) : isPaid && latestPayment ? (
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-emerald-700 font-semibold text-lg">Paid</p>
              <p className="text-slate-500 text-sm mt-0.5">
                {formatINR(latestPayment.amount + (latestPayment.lateFeeApplied ?? 0))} paid on{' '}
                {formatDate(latestPayment.paidAt)}
              </p>
              {latestPayment.phonePeTxnId && (
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  Txn: {latestPayment.phonePeTxnId}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-3xl font-bold text-slate-900">{formatINR(totalDue)}</p>
                <div className="mt-1 space-y-0.5">
                  <p className="text-sm text-slate-500">
                    Base fee: {formatINR(feeSchedule.amount)}
                  </p>
                  {isLate && feeSchedule.lateFee > 0 && (
                    <p className="text-sm text-red-600">
                      Late fee: +{formatINR(feeSchedule.lateFee)}
                    </p>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Due: {formatDate(feeSchedule.dueDate)}
                  {isLate && (
                    <span className="ml-2 text-red-500 font-medium">Overdue</span>
                  )}
                </p>
              </div>
              <PayNowButton feeScheduleId={feeSchedule.id} />
            </div>
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Payment History</h2>
        </div>
        {recentPayments.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-slate-400 text-sm">No payment history yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Month
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Amount
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Paid On
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Txn ID
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-slate-700 font-medium">
                    {payment.feeSchedule.monthYear}
                  </td>
                  <td className="px-6 py-4 text-slate-900 font-semibold">
                    {formatINR(payment.amount + (payment.lateFeeApplied ?? 0))}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={statusVariant[payment.status]}>
                      {statusLabel[payment.status]}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    {formatDate(payment.paidAt)}
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs font-mono">
                    {payment.phonePeTxnId ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
