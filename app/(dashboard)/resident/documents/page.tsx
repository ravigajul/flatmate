import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import type { DocumentCategory } from '@prisma/client'
import { FolderOpen, Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import DocFilters from './doc-filters'

const categoryLabel: Record<DocumentCategory, string> = {
  MEETING_MINUTES: 'Meeting Minutes',
  FINANCIAL_AUDIT: 'Financial Audit',
  MAINTENANCE_CONTRACT: 'Maintenance Contract',
  INVOICE: 'Invoice',
  OTHER: 'Other',
}

const categoryVariant: Record<
  DocumentCategory,
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

export default async function ResidentDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { category } = await searchParams

  const where: Record<string, unknown> = {}
  if (category) where.category = category as DocumentCategory

  const documents = await prisma.document.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      uploadedBy: { select: { name: true } },
    },
  })

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Document Vault</h1>
        <p className="text-slate-500 text-sm mt-1">Shared documents for all residents</p>
      </div>

      <div className="mb-4">
        <DocFilters currentCategory={category ?? ''} />
      </div>

      {documents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-16 text-center">
          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No documents found</p>
          <p className="text-slate-400 text-sm mt-1">
            Check back later for uploaded documents
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
                  Download
                </th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
