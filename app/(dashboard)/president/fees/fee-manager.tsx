'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, IndianRupee } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'

interface Payment {
  id: string
  status: string
  paidAt: string | null
  amount: number
  phonePeTxnId: string | null
}

interface FeeSchedule {
  id: string
  unitId: string
  amount: number
  lateFee: number
  monthYear: string
  dueDate: string
  unit: {
    flatNumber: string
    ownerName: string | null
  }
  payments: Payment[]
}

interface FeeManagerProps {
  schedules: FeeSchedule[]
  currentMonth: string
  stats: {
    totalDue: number
    totalCollected: number
    outstanding: number
    collectionRate: number
  }
}

interface GenerateFormData {
  defaultAmount: string
  lateFee: string
  dueDate: string
}

interface EditFormData {
  amount: string
  lateFee: string
  dueDate: string
}

function formatINR(amount: number) {
  return '₹' + amount.toLocaleString('en-IN')
}

function formatDate(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const defaultDueDate = () => {
  const d = new Date()
  d.setDate(10)
  return d.toISOString().split('T')[0]
}

export default function FeeManager({ schedules, currentMonth, stats }: FeeManagerProps) {
  const router = useRouter()
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)

  // Generate fees modal
  const [generateOpen, setGenerateOpen] = useState(false)
  const [generateForm, setGenerateForm] = useState<GenerateFormData>({
    defaultAmount: '2000',
    lateFee: '200',
    dueDate: defaultDueDate(),
  })
  const [generateLoading, setGenerateLoading] = useState(false)
  const [generateError, setGenerateError] = useState('')

  // Delete fee
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')

  // Edit fee modal
  const [editOpen, setEditOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<FeeSchedule | null>(null)
  const [editForm, setEditForm] = useState<EditFormData>({ amount: '', lateFee: '', dueDate: '' })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  function handleMonthChange(month: string) {
    setSelectedMonth(month)
    router.push(`/president/fees?month=${month}`)
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/fees/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setDeleteError(data.error ?? 'Failed to delete fee schedule')
        return
      }
      setDeleteConfirmId(null)
      setDeleteError('')
      router.refresh()
    } catch {
      setDeleteError('Something went wrong')
    }
  }

  function openEdit(schedule: FeeSchedule) {
    setEditingSchedule(schedule)
    setEditForm({
      amount: String(schedule.amount),
      lateFee: String(schedule.lateFee),
      dueDate: new Date(schedule.dueDate).toISOString().split('T')[0],
    })
    setEditError('')
    setEditOpen(true)
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setGenerateLoading(true)
    setGenerateError('')

    try {
      const res = await fetch('/api/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          defaultAmount: parseFloat(generateForm.defaultAmount),
          lateFee: parseFloat(generateForm.lateFee) || 0,
          dueDate: generateForm.dueDate,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.formErrors?.[0] ?? data.error ?? 'Failed to generate fees')
      }

      setGenerateOpen(false)
      router.refresh()
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setGenerateLoading(false)
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingSchedule) return
    setEditLoading(true)
    setEditError('')

    try {
      const res = await fetch(`/api/fees/${editingSchedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(editForm.amount),
          lateFee: parseFloat(editForm.lateFee) || 0,
          dueDate: editForm.dueDate,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.formErrors?.[0] ?? data.error ?? 'Failed to update fee')
      }

      setEditOpen(false)
      router.refresh()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setEditLoading(false)
    }
  }

  return (
    <>
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Total Due</p>
          <p className="text-xl font-bold text-slate-900">{formatINR(stats.totalDue)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Collected</p>
          <p className="text-xl font-bold text-emerald-600">{formatINR(stats.totalCollected)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Outstanding</p>
          <p className="text-xl font-bold text-red-600">{formatINR(stats.outstanding)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Collection Rate</p>
          <p className="text-xl font-bold text-indigo-600">{stats.collectionRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700">Month</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => {
            setGenerateError('')
            setGenerateOpen(true)
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Generate Fees
        </button>
      </div>

      {/* Table */}
      {schedules.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-16 text-center">
          <IndianRupee className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No fee schedules for {selectedMonth}</p>
          <p className="text-slate-400 text-sm mt-1">
            Click &quot;Generate Fees&quot; to create fee schedules for all units
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Flat</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Owner</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Fee Amount</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Late Fee</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Due Date</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Paid On</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {schedules.map((schedule) => {
                const payment = schedule.payments[0] ?? null
                const isPaid = payment?.status === 'SUCCESS'

                return (
                  <tr key={schedule.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{schedule.unit.flatNumber}</td>
                    <td className="px-6 py-4 text-slate-600">{schedule.unit.ownerName ?? '—'}</td>
                    <td className="px-6 py-4 text-slate-900 font-semibold">{formatINR(schedule.amount)}</td>
                    <td className="px-6 py-4 text-slate-500">
                      {schedule.lateFee > 0 ? formatINR(schedule.lateFee) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">{formatDate(schedule.dueDate)}</td>
                    <td className="px-6 py-4">
                      {isPaid ? (
                        <Badge variant="success">Paid</Badge>
                      ) : payment ? (
                        <Badge variant="warning">Pending</Badge>
                      ) : (
                        <Badge variant="muted">No Payment</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs">
                      {isPaid ? formatDate(payment.paidAt) : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {deleteConfirmId === schedule.id ? (
                          <>
                            <button onClick={() => handleDelete(schedule.id)} className="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">Confirm</button>
                            <button onClick={() => { setDeleteConfirmId(null); setDeleteError('') }} className="px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => openEdit(schedule)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Edit fee">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { setDeleteConfirmId(schedule.id); setDeleteError('') }} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete fee">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                      {deleteConfirmId === schedule.id && deleteError && (
                        <p className="text-xs text-red-600 mt-1 text-right">{deleteError}</p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Generate Fees Modal */}
      <Modal open={generateOpen} onClose={() => setGenerateOpen(false)} title="Generate Fee Schedules">
        <form onSubmit={handleGenerate} className="space-y-4">
          <p className="text-sm text-slate-500">
            Generate fee schedules for <strong>{selectedMonth}</strong> for all units that don&apos;t have one yet.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Default Amount (₹) <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="number"
                min="1"
                step="0.01"
                value={generateForm.defaultAmount}
                onChange={(e) => setGenerateForm({ ...generateForm, defaultAmount: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Late Fee (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={generateForm.lateFee}
                onChange={(e) => setGenerateForm({ ...generateForm, lateFee: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Due Date <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="date"
              value={generateForm.dueDate}
              onChange={(e) => setGenerateForm({ ...generateForm, dueDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {generateError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {generateError}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setGenerateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={generateLoading}>
              Generate
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Fee Modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit Fee — ${editingSchedule?.unit.flatNumber ?? ''}`}
      >
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Amount (₹) <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="number"
                min="1"
                step="0.01"
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Late Fee (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editForm.lateFee}
                onChange={(e) => setEditForm({ ...editForm, lateFee: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Due Date <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="date"
              value={editForm.dueDate}
              onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {editError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {editError}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={editLoading}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
