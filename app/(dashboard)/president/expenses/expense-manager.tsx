'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'

const CATEGORIES = [
  'REPAIRS',
  'UTILITIES',
  'SALARIES',
  'CLEANING',
  'SECURITY',
  'AMC',
  'MISCELLANEOUS',
] as const

type ExpenseCategory = (typeof CATEGORIES)[number]

const categoryLabel: Record<ExpenseCategory, string> = {
  REPAIRS: 'Repairs',
  UTILITIES: 'Utilities',
  SALARIES: 'Salaries',
  CLEANING: 'Cleaning',
  SECURITY: 'Security',
  AMC: 'AMC',
  MISCELLANEOUS: 'Miscellaneous',
}

const categoryVariant: Record<
  ExpenseCategory,
  'warning' | 'info' | 'default' | 'muted' | 'danger'
> = {
  REPAIRS: 'warning',
  UTILITIES: 'info',
  SALARIES: 'default',
  CLEANING: 'muted',
  SECURITY: 'danger',
  AMC: 'info',
  MISCELLANEOUS: 'muted',
}

interface Expense {
  id: string
  amount: number
  category: ExpenseCategory
  vendor: string | null
  description: string
  expenseDate: string
  receiptUrl: string | null
  addedBy: { name: string | null }
}

interface ExpenseFormData {
  description: string
  amount: string
  category: ExpenseCategory | ''
  vendor: string
  expenseDate: string
  receiptUrl: string
}

const emptyForm: ExpenseFormData = {
  description: '',
  amount: '',
  category: '',
  vendor: '',
  expenseDate: new Date().toISOString().split('T')[0],
  receiptUrl: '',
}

interface InitialFilters {
  category?: string
  from?: string
  to?: string
}

interface ExpenseManagerProps {
  expenses: Expense[]
  initialFilters: InitialFilters
}

function formatINR(amount: number) {
  return '₹' + amount.toLocaleString('en-IN')
}

export default function ExpenseManager({ expenses, initialFilters }: ExpenseManagerProps) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [form, setForm] = useState<ExpenseFormData>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Filter state
  const [filterCategory, setFilterCategory] = useState(initialFilters.category ?? '')
  const [filterFrom, setFilterFrom] = useState(initialFilters.from ?? '')
  const [filterTo, setFilterTo] = useState(initialFilters.to ?? '')

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  function openEdit(expense: Expense) {
    setEditing(expense)
    setForm({
      description: expense.description,
      amount: String(expense.amount),
      category: expense.category,
      vendor: expense.vendor ?? '',
      expenseDate: new Date(expense.expenseDate).toISOString().split('T')[0],
      receiptUrl: expense.receiptUrl ?? '',
    })
    setError('')
    setModalOpen(true)
  }

  function applyFilters() {
    const params = new URLSearchParams()
    if (filterCategory) params.set('category', filterCategory)
    if (filterFrom) params.set('from', filterFrom)
    if (filterTo) params.set('to', filterTo)
    router.push(`/president/expenses?${params.toString()}`)
  }

  function clearFilters() {
    setFilterCategory('')
    setFilterFrom('')
    setFilterTo('')
    router.push('/president/expenses')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const payload = {
      description: form.description.trim(),
      amount: parseFloat(form.amount),
      category: form.category,
      vendor: form.vendor.trim() || undefined,
      expenseDate: form.expenseDate,
      receiptUrl: form.receiptUrl.trim() || undefined,
    }

    try {
      const res = await fetch(editing ? `/api/expenses/${editing.id}` : '/api/expenses', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(
          data.error?.formErrors?.[0] ?? data.error ?? 'Something went wrong'
        )
      }
      setModalOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to delete expense')
      }
      setDeleteConfirmId(null)
      router.refresh()
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">From</label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">To</label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={applyFilters} size="sm">
              Filter
            </Button>
            <Button onClick={clearFilters} variant="secondary" size="sm">
              Clear
            </Button>
          </div>
        </div>
      </div>

      {/* Actions row */}
      <div className="flex justify-end mb-4">
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Expense
        </button>
      </div>

      {/* Table */}
      {expenses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-16 text-center">
          <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No expenses found</p>
          <p className="text-slate-400 text-sm mt-1">
            Add the first expense to start tracking
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Date
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Category
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Vendor
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Description
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Amount
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-slate-600 text-xs">
                    {new Date(expense.expenseDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={categoryVariant[expense.category]}>
                      {categoryLabel[expense.category]}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {expense.vendor ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-6 py-4 text-slate-700 max-w-xs">
                    <span className="line-clamp-2">{expense.description}</span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-900">
                    {formatINR(expense.amount)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(expense)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {deleteConfirmId === expense.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(expense.id)}
                            disabled={deletingId === expense.id}
                            className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                          >
                            {deletingId === expense.id ? 'Deleting...' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(expense.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Expense' : 'Add Expense'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. Replaced water pump motor"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Amount (₹) <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="e.g. 5000"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Select category</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel[c]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Vendor</label>
              <input
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                placeholder="e.g. Sharma Electricals"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="date"
                value={form.expenseDate}
                onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Receipt URL
            </label>
            <input
              type="url"
              value={form.receiptUrl}
              onChange={(e) => setForm({ ...form, receiptUrl: e.target.value })}
              placeholder="https://..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {editing ? 'Save Changes' : 'Add Expense'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
