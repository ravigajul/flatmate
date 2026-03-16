'use client'

import { useState } from 'react'
import { Users, CheckCircle, XCircle, Search } from 'lucide-react' // eslint-disable-line @typescript-eslint/no-unused-vars
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

interface Unit {
  id: string
  flatNumber: string
  block: string | null
}

interface User {
  id: string
  name: string | null
  email: string
  phone: string | null
  role: string
  unitId: string | null
  isActive: boolean
  createdAt: string | Date
  image: string | null
  unit: { flatNumber: string } | null
}

interface Props {
  users: User[]
  units: Unit[]
  currentUserId: string
  isSuperAdmin?: boolean
}

const roleBadge = (role: string) => {
  if (role === 'SUPER_ADMIN') return <Badge variant="danger">Super Admin</Badge>
  if (role === 'PRESIDENT') return <Badge variant="default">President</Badge>
  return <Badge variant="muted">Resident</Badge>
}

export default function UsersClient({ users, units, currentUserId }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'pending'>('all')
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.unit?.flatNumber.toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'all' ||
      (filter === 'active' && u.isActive) ||
      (filter === 'pending' && !u.isActive)
    return matchSearch && matchFilter
  })

  async function patch(id: string, data: Record<string, unknown>) {
    setLoadingId(id)
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed')
      router.refresh()
    } finally {
      setLoadingId(null)
    }
  }

  const initials = (user: User) =>
    user.name
      ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
      : user.email[0].toUpperCase()

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or flat..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div className="flex rounded-lg border border-slate-300 overflow-hidden text-sm">
          {(['all', 'active', 'pending'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 font-medium transition-colors capitalize ${
                filter === f
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-16 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No residents found</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Resident</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Assign Unit</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-semibold flex-shrink-0">
                        {initials(user)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{user.name ?? '—'}</p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {user.unit ? (
                      <span className="font-medium text-slate-700">{user.unit.flatNumber}</span>
                    ) : (
                      <span className="text-slate-300 text-xs">Not assigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4">{roleBadge(user.role)}</td>
                  <td className="px-6 py-4">
                    <Badge variant={user.isActive ? 'success' : 'warning'}>
                      {user.isActive ? 'Active' : 'Pending'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={user.unitId ?? ''}
                      disabled={loadingId === user.id}
                      onChange={(e) => patch(user.id, { unitId: e.target.value || null })}
                      className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:opacity-50"
                    >
                      <option value="">No unit</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.flatNumber}{u.block ? ` (Block ${u.block})` : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {user.id !== currentUserId && (
                      <Button
                        size="sm"
                        variant={user.isActive ? 'danger' : 'primary'}
                        loading={loadingId === user.id}
                        onClick={() => patch(user.id, { isActive: !user.isActive })}
                      >
                        {user.isActive ? (
                          <><XCircle className="w-3.5 h-3.5" />Deactivate</>
                        ) : (
                          <><CheckCircle className="w-3.5 h-3.5" />Activate</>
                        )}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
