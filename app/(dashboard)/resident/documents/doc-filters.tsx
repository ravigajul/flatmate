'use client'

import { useRouter } from 'next/navigation'

const CATEGORIES = [
  { value: 'MEETING_MINUTES', label: 'Meeting Minutes' },
  { value: 'FINANCIAL_AUDIT', label: 'Financial Audit' },
  { value: 'MAINTENANCE_CONTRACT', label: 'Maintenance Contract' },
  { value: 'INVOICE', label: 'Invoice' },
  { value: 'OTHER', label: 'Other' },
]

interface DocFiltersProps {
  currentCategory: string
}

export default function DocFilters({ currentCategory }: DocFiltersProps) {
  const router = useRouter()

  function handleChange(value: string) {
    const params = new URLSearchParams()
    if (value) params.set('category', value)
    router.push(`/resident/documents?${params.toString()}`)
  }

  return (
    <select
      value={currentCategory}
      onChange={(e) => handleChange(e.target.value)}
      className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
    >
      <option value="">All Categories</option>
      {CATEGORIES.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
    </select>
  )
}
