import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}))
vi.mock('@/lib/audit', () => ({ writeAuditLog: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { DELETE } from '@/app/api/documents/[id]/route'

const mockAuth = vi.mocked(auth)
const mockFindUnique = vi.mocked(prisma.document.findUnique)
const mockDelete = vi.mocked(prisma.document.delete)
const mockAudit = vi.mocked(writeAuditLog)

function makeDeleteRequest(): Request {
  return new Request('http://localhost:3000/api/documents/doc-1', { method: 'DELETE' })
}

const sampleDocument = {
  id: 'doc-1',
  name: 'AGM Minutes March 2024',
  url: 'https://example.com/agm-minutes.pdf',
  category: 'MEETING_MINUTES',
  fileSize: null,
  uploadedById: 'u1',
  createdAt: new Date(),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAudit.mockResolvedValue(undefined as never)
  mockDelete.mockResolvedValue(sampleDocument as never)
})

describe('DELETE /api/documents/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ id: 'doc-1' }) })
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 when RESIDENT tries to delete', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ id: 'doc-1' }) })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Forbidden')
  })

  it('returns 404 when document not found', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(null)

    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ id: 'nonexistent' }) })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Document not found')
  })

  it('returns 200 and deletes when PRESIDENT', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(sampleDocument as never)

    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ id: 'doc-1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('calls prisma.document.delete with correct id', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(sampleDocument as never)

    await DELETE(makeDeleteRequest(), { params: Promise.resolve({ id: 'doc-1' }) })
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'doc-1' } })
  })

  it('writes audit log on successful deletion', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(sampleDocument as never)

    await DELETE(makeDeleteRequest(), { params: Promise.resolve({ id: 'doc-1' }) })
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DOCUMENT_DELETED',
        entity: 'Document',
        entityId: 'doc-1',
      })
    )
  })

  it('SUPER_ADMIN can delete document', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u0', role: 'SUPER_ADMIN', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(sampleDocument as never)

    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ id: 'doc-1' }) })
    expect(res.status).toBe(200)
  })
})
