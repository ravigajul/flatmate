'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, FolderOpen, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'

const CATEGORIES = [
  'MEETING_MINUTES',
  'FINANCIAL_AUDIT',
  'MAINTENANCE_CONTRACT',
  'INVOICE',
  'OTHER',
] as const

type DocCategory = (typeof CATEGORIES)[number]

const categoryLabel: Record<DocCategory, string> = {
  MEETING_MINUTES: 'Meeting Minutes',
  FINANCIAL_AUDIT: 'Financial Audit',
  MAINTENANCE_CONTRACT: 'Maintenance Contract',
  INVOICE: 'Invoice',
  OTHER: 'Other',
}

const categoryVariant: Record<
  DocCategory,
  'default' | 'warning' | 'info' | 'success' | 'muted'
> = {
  MEETING_MINUTES: 'default',
  FINANCIAL_AUDIT: 'warning',
  MAINTENANCE_CONTRACT: 'info',
  INVOICE: 'success',
  OTHER: 'muted',
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Document {
  id: string
  name: string
  url: string
  category: DocCategory
  fileSize: number | null
  createdAt: string
  uploadedBy: { name: string | null }
}

interface DocumentManagerProps {
  documents: Document[]
  currentCategory: string
}

interface FormData {
  name: string
  url: string
  category: DocCategory | ''
  fileSize: string
}

const emptyForm: FormData = {
  name: '',
  url: '',
  category: '',
  fileSize: '',
}

export default function DocumentManager({ documents, currentCategory }: DocumentManagerProps) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState(currentCategory)

  function openAdd() {
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  function handleCategoryFilter(value: string) {
    setFilterCategory(value)
    const params = new URLSearchParams()
    if (value) params.set('category', value)
    router.push(`/president/documents?${params.toString()}`)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      url: form.url.trim(),
      category: form.category,
    }
    if (form.fileSize.trim()) {
      payload.fileSize = parseInt(form.fileSize, 10)
    }

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
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
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to delete document')
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
      {/* Filter + Upload row */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <select
            value={filterCategory}
            onChange={(e) => handleCategoryFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel[c]}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Upload Document
        </button>
      </div>

      {/* Table */}
      {documents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-16 text-center">
          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No documents found</p>
          <p className="text-slate-400 text-sm mt-1">
            Upload the first document to the vault
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
                  Name
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Category
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Size
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Uploaded By
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Download
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-slate-600 text-xs whitespace-nowrap">
                    {new Date(doc.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-6 py-4 text-slate-800 font-medium max-w-xs">
                    <span className="line-clamp-2">{doc.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={categoryVariant[doc.category]}>
                      {categoryLabel[doc.category]}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    {formatFileSize(doc.fileSize)}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {doc.uploadedBy.name ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-6 py-4">
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </a>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {deleteConfirmId === doc.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(doc.id)}
                            disabled={deletingId === doc.id}
                            className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                          >
                            {deletingId === doc.id ? 'Deleting...' : 'Confirm'}
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
                          onClick={() => setDeleteConfirmId(doc.id)}
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
        title="Upload Document"
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Document Name <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. AGM Minutes March 2024"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Document URL <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as DocCategory })}
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
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                File Size (bytes)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.fileSize}
                onChange={(e) => setForm({ ...form, fileSize: e.target.value })}
                placeholder="e.g. 204800"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
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
              Upload Document
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
