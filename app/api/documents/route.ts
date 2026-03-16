import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import type { DocumentCategory } from '@prisma/client'

const documentCategoryEnum = z.enum([
  'MEETING_MINUTES',
  'FINANCIAL_AUDIT',
  'MAINTENANCE_CONTRACT',
  'INVOICE',
  'OTHER',
])

const createDocumentSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url(),
  category: documentCategoryEnum,
  fileSize: z.number().int().positive().optional(),
})

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') as DocumentCategory | null

  const where: Record<string, unknown> = {}
  if (category) where.category = category

  const documents = await prisma.document.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      uploadedBy: { select: { name: true } },
    },
  })

  return NextResponse.json(documents)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'PRESIDENT' && session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createDocumentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const document = await prisma.document.create({
    data: {
      name: parsed.data.name,
      url: parsed.data.url,
      category: parsed.data.category as DocumentCategory,
      fileSize: parsed.data.fileSize,
      uploadedById: session.user.id,
    },
    include: {
      uploadedBy: { select: { name: true } },
    },
  })

  await writeAuditLog({
    userId: session.user.id,
    action: 'DOCUMENT_UPLOADED',
    entity: 'Document',
    entityId: document.id,
    metadata: { name: document.name, category: document.category },
  })

  return NextResponse.json(document, { status: 201 })
}
