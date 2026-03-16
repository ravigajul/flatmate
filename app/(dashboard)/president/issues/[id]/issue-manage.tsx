'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

const statusOptions = [
  { value: 'OPEN', label: 'Open' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
]

interface IssueManageProps {
  issueId: string
  currentStatus: string
  currentAssignedTo: string | null
}

export default function IssueManage({
  issueId,
  currentStatus,
  currentAssignedTo,
}: IssueManageProps) {
  const router = useRouter()

  const [status, setStatus] = useState(currentStatus)
  const [assignedTo, setAssignedTo] = useState(currentAssignedTo ?? '')
  const [statusLoading, setStatusLoading] = useState(false)
  const [assignLoading, setAssignLoading] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [assignError, setAssignError] = useState('')
  const [statusSuccess, setStatusSuccess] = useState(false)
  const [assignSuccess, setAssignSuccess] = useState(false)

  async function handleStatusUpdate(e: React.FormEvent) {
    e.preventDefault()
    setStatusLoading(true)
    setStatusError('')
    setStatusSuccess(false)

    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to update status')
      }

      setStatusSuccess(true)
      router.refresh()
      setTimeout(() => setStatusSuccess(false), 2000)
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setStatusLoading(false)
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    setAssignLoading(true)
    setAssignError('')
    setAssignSuccess(false)

    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo: assignedTo.trim() || null }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to update assignment')
      }

      setAssignSuccess(true)
      router.refresh()
      setTimeout(() => setAssignSuccess(false), 2000)
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setAssignLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-6">
      <h2 className="text-sm font-semibold text-slate-700">Manage Issue</h2>

      {/* Status update */}
      <form onSubmit={handleStatusUpdate} className="space-y-3">
        <label className="block text-xs font-medium text-slate-700">Update Status</label>
        <div className="flex gap-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" loading={statusLoading}>
            Update
          </Button>
        </div>
        {statusError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {statusError}
          </p>
        )}
        {statusSuccess && (
          <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            Status updated successfully
          </p>
        )}
      </form>

      {/* Assign to */}
      <form onSubmit={handleAssign} className="space-y-3">
        <label className="block text-xs font-medium text-slate-700">
          Assign To <span className="text-slate-400 font-normal">(name of technician / person)</span>
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            placeholder="e.g. Ravi (Plumber)"
            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <Button type="submit" size="sm" loading={assignLoading}>
            Assign
          </Button>
        </div>
        {assignError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {assignError}
          </p>
        )}
        {assignSuccess && (
          <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            Assignment updated successfully
          </p>
        )}
      </form>
    </div>
  )
}
