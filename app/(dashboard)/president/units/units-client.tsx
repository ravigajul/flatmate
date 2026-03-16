'use client'

import { useState } from 'react'
import { Plus, Pencil, Building2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { useRouter } from 'next/navigation'

interface Resident {
  id: string
  name: string | null
  email: string
}

interface Unit {
  id: string
  flatNumber: string
  block: string | null
  floor: number
  areaSqft: number | null
  ownerName: string | null
  isOccupied: boolean
  residents: Resident[]
}

interface UnitFormData {
  flatNumber: string
  block: string
  floor: string
  areaSqft: string
  ownerName: string
}

const emptyForm: UnitFormData = { flatNumber: '', block: '', floor: '', areaSqft: '', ownerName: '' }

export default function UnitsClient({ units }: { units: Unit[] }) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Unit | null>(null)
  const [form, setForm] = useState<UnitFormData>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  function openEdit(unit: Unit) {
    setEditing(unit)
    setForm({
      flatNumber: unit.flatNumber,
      block: unit.block ?? '',
      floor: String(unit.floor),
      areaSqft: unit.areaSqft ? String(unit.areaSqft) : '',
      ownerName: unit.ownerName ?? '',
    })
    setError('')
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const payload = {
      flatNumber: form.flatNumber.trim(),
      block: form.block.trim() || undefined,
      floor: parseInt(form.floor),
      areaSqft: form.areaSqft ? parseFloat(form.areaSqft) : undefined,
      ownerName: form.ownerName.trim() || undefined,
    }

    try {
      const res = await fetch(
        editing ? `/api/units/${editing.id}` : '/api/units',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.formErrors?.[0] ?? 'Something went wrong')
      }
      setModalOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Add button */}
      <div className="flex justify-end mb-4">
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4" />
          Add Unit
        </Button>
      </div>

      {/* Units grid */}
      {units.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-16 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No units yet</p>
          <p className="text-slate-400 text-sm mt-1">Add the first unit to get started</p>
          <Button onClick={openAdd} className="mt-4">
            <Plus className="w-4 h-4" />
            Add Unit
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Flat</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Block / Floor</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Area</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Owner</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Residents</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {units.map((unit) => (
                <tr key={unit.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-semibold text-slate-900">{unit.flatNumber}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {[unit.block && `Block ${unit.block}`, `Floor ${unit.floor}`].filter(Boolean).join(' · ')}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {unit.areaSqft ? `${unit.areaSqft} sqft` : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {unit.ownerName ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-6 py-4">
                    {unit.residents.length > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-600">{unit.residents.length}</span>
                      </div>
                    ) : (
                      <span className="text-slate-300 text-xs">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={unit.isOccupied ? 'success' : 'muted'}>
                      {unit.isOccupied ? 'Occupied' : 'Vacant'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openEdit(unit)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
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
        title={editing ? `Edit Unit ${editing.flatNumber}` : 'Add New Unit'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Flat Number <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.flatNumber}
                onChange={(e) => setForm({ ...form, flatNumber: e.target.value })}
                placeholder="e.g. A101"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Block</label>
              <input
                value={form.block}
                onChange={(e) => setForm({ ...form, block: e.target.value })}
                placeholder="e.g. A"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Floor <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="number"
                min="0"
                value={form.floor}
                onChange={(e) => setForm({ ...form, floor: e.target.value })}
                placeholder="e.g. 1"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Area (sqft)</label>
              <input
                type="number"
                min="0"
                value={form.areaSqft}
                onChange={(e) => setForm({ ...form, areaSqft: e.target.value })}
                placeholder="e.g. 1200"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Owner Name</label>
            <input
              value={form.ownerName}
              onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
              placeholder="Property owner's name"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {editing ? 'Save Changes' : 'Add Unit'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
