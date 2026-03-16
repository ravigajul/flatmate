'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'

interface CollectionRow {
  unitId: string
  flatNumber: string
  ownerName: string | null
  feeAmount: number | null
  paymentStatus: 'PAID' | 'PENDING' | 'NO_FEE'
  paidAt: string | null
}

function getCurrentMonth() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function formatINR(amount: number) {
  return '₹' + amount.toLocaleString('en-IN')
}

export default function CollectionTable() {
  const [month, setMonth] = useState(getCurrentMonth())
  const [rows, setRows] = useState<CollectionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/reports/collection?month=${month}`)
        if (!res.ok) throw new Error('Failed to fetch collection data')
        const data = await res.json()
        setRows(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [month])

  const paidCount = rows.filter((r) => r.paymentStatus === 'PAID').length
  const pendingCount = rows.filter((r) => r.paymentStatus === 'PENDING').length
  const totalCollected = rows
    .filter((r) => r.paymentStatus === 'PAID' && r.feeAmount)
    .reduce((sum, r) => sum + (r.feeAmount ?? 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        {!loading && rows.length > 0 && (
          <div className="flex gap-4 text-sm pt-4">
            <span className="text-emerald-600 font-medium">{paidCount} paid</span>
            <span className="text-amber-600 font-medium">{pendingCount} pending</span>
            <span className="text-slate-600 font-medium">
              Collected: {formatINR(totalCollected)}
            </span>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-8 text-center text-slate-500 text-sm">
          Loading...
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-8 text-center text-slate-500 text-sm">
          No data for this month
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Flat
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Owner
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Fee Amount
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Paid At
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.unitId} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-900">{row.flatNumber}</td>
                  <td className="px-6 py-4 text-slate-600">
                    {row.ownerName ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-6 py-4 text-slate-700">
                    {row.feeAmount !== null ? (
                      formatINR(row.feeAmount)
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {row.paymentStatus === 'PAID' ? (
                      <Badge variant="success">Paid</Badge>
                    ) : row.paymentStatus === 'PENDING' ? (
                      <Badge variant="warning">Pending</Badge>
                    ) : (
                      <Badge variant="muted">No Fee</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    {row.paidAt
                      ? new Date(row.paidAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
