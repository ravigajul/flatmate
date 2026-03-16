import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import type { DocumentCategory } from '@prisma/client'
import DocumentManager from './document-manager'

export default async function PresidentDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'PRESIDENT' && session.user.role !== 'SUPER_ADMIN') {
    redirect('/resident')
  }

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
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Document Vault</h1>
          <p className="text-slate-500 text-sm mt-1">
            {documents.length} document{documents.length !== 1 ? 's' : ''} stored
          </p>
        </div>
      </div>

      <DocumentManager
        documents={documents.map((d) => ({
          ...d,
          createdAt: d.createdAt.toISOString(),
        }))}
        currentCategory={category ?? ''}
      />
    </div>
  )
}
