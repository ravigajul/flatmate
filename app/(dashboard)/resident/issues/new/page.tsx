'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Camera, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

const categoryOptions = [
  { value: 'ELECTRICAL', label: 'Electrical' },
  { value: 'PLUMBING', label: 'Plumbing' },
  { value: 'LIFT', label: 'Lift' },
  { value: 'COMMON_AREA', label: 'Common Area' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'OTHER', label: 'Other' },
]

const priorityOptions = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
]

interface PhotoPreview {
  file: File
  previewUrl: string
  uploadedUrl?: string
  uploading: boolean
  error?: string
}

export default function NewIssuePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('ELECTRICAL')
  const [priority, setPriority] = useState('MEDIUM')
  const [photos, setPhotos] = useState<PhotoPreview[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function uploadPhoto(file: File, index: number) {
    setPhotos((prev) =>
      prev.map((p, i) => (i === index ? { ...p, uploading: true, error: undefined } : p))
    )

    try {
      const fd = new FormData()
      fd.append('file', file)

      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error ?? 'Upload failed')

      setPhotos((prev) =>
        prev.map((p, i) =>
          i === index ? { ...p, uploading: false, uploadedUrl: data.url } : p
        )
      )
    } catch (err) {
      setPhotos((prev) =>
        prev.map((p, i) =>
          i === index
            ? { ...p, uploading: false, error: err instanceof Error ? err.message : 'Upload failed' }
            : p
        )
      )
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const remaining = 3 - photos.length
    const toAdd = files.slice(0, remaining)

    const startIdx = photos.length
    const newPhotos: PhotoPreview[] = toAdd.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      uploading: false,
    }))

    setPhotos((prev) => [...prev, ...newPhotos])

    // Kick off uploads outside the state updater to avoid double-invocation in StrictMode
    toAdd.forEach((file, i) => {
      uploadPhoto(file, startIdx + i)
    })

    // Reset input so same file can be re-selected after removal
    e.target.value = ''
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const stillUploading = photos.some((p) => p.uploading)
    if (stillUploading) {
      setError('Please wait for photos to finish uploading')
      return
    }

    const uploadErrors = photos.filter((p) => p.error)
    if (uploadErrors.length > 0) {
      setError('Some photos failed to upload. Remove them and try again.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const photoUrls = photos
        .map((p) => p.uploadedUrl)
        .filter((url): url is string => !!url)

      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          priority,
          photoUrls,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Something went wrong')
      }

      router.push('/resident/issues')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/resident/issues"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        My Issues
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Raise an Issue</h1>
        <p className="text-slate-500 text-sm mt-1">
          Report a maintenance problem in your unit or common area
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of the issue"
              className={inputClass}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue in detail — what happened, when, and where"
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Category + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputClass}
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={inputClass}
              >
                {priorityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Photo upload — 3 always-visible slots */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">
              Photos <span className="text-slate-400 font-normal">(optional · up to 3 · max 5 MB each)</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="flex gap-3">
              {[0, 1, 2].map((slot) => {
                const photo = photos[slot]
                if (photo) {
                  return (
                    <div key={slot} className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex-shrink-0">
                      <img src={photo.previewUrl} alt={`Photo ${slot + 1}`} className="w-full h-full object-cover" />
                      {photo.uploading && (
                        <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                        </div>
                      )}
                      {photo.error && (
                        <div className="absolute inset-0 bg-red-50/90 flex items-center justify-center p-1">
                          <p className="text-red-600 text-[10px] text-center leading-tight">{photo.error}</p>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(slot)}
                        className="absolute top-1 right-1 w-5 h-5 bg-slate-900/60 hover:bg-slate-900/80 rounded-full flex items-center justify-center transition-colors"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  )
                }
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-24 h-24 flex-shrink-0 rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-indigo-500 transition-colors"
                  >
                    <Camera className="w-5 h-5" />
                    <span className="text-[10px] font-medium">Photo {slot + 1}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/resident/issues')}
            >
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Submit Issue
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
