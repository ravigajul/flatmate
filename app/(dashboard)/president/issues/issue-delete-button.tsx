'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export default function IssueDeleteButton({ issueId }: { issueId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    try {
      const res = await fetch(`/api/issues/${issueId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to delete issue')
        return
      }
      setConfirming(false)
      setError('')
      router.refresh()
    } catch {
      setError('Something went wrong')
    }
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1">
          <button
            onClick={handleDelete}
            className="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            Confirm
          </button>
          <button
            onClick={() => { setConfirming(false); setError('') }}
            className="px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <button
      onClick={() => { setConfirming(true); setError('') }}
      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
      title="Delete issue"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  )
}
