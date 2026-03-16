import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))
vi.mock('@/lib/audit', () => ({ writeAuditLog: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { GET, POST } from '@/app/api/documents/route'

const mockAuth = vi.mocked(auth)
const mockFindMany = vi.mocked(prisma.document.findMany)
const mockCreate = vi.mocked(prisma.document.create)
const mockAudit = vi.mocked(writeAuditLog)

function makeGetRequest(search = ''): Request {
  return new Request(`http://localhost:3000/api/documents${search}`, { method: 'GET' })
}

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validDocBody = {
  name: 'AGM Minutes March 2024',
  url: 'https://example.com/agm-minutes.pdf',
  category: 'MEETING_MINUTES',
}

const sampleDocument = {
  id: 'doc-1',
  name: 'AGM Minutes March 2024',
  url: 'https://example.com/agm-minutes.pdf',
  category: 'MEETING_MINUTES',
  fileSize: null,
  uploadedById: 'u1',
  createdAt: new Date(),
  uploadedBy: { name: 'Admin User' },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAudit.mockResolvedValue(undefined as never)
})

describe('GET /api/documents', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns documents array when authenticated', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindMany.mockResolvedValue([sampleDocument] as never)

    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
    expect(json[0].id).toBe('doc-1')
  })

  it('RESIDENT can GET documents', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindMany.mockResolvedValue([] as never)

    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
  })

  it('applies category filter when ?category= is provided', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindMany.mockResolvedValue([] as never)

    await GET(makeGetRequest('?category=FINANCIAL_AUDIT'))
    const callArg = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(callArg.where.category).toBe('FINANCIAL_AUDIT')
  })

  it('does not apply category filter when not provided', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindMany.mockResolvedValue([] as never)

    await GET(makeGetRequest())
    const callArg = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(callArg.where).not.toHaveProperty('category')
  })
})

describe('POST /api/documents', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(makePostRequest(validDocBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 when RESIDENT tries to upload', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await POST(makePostRequest(validDocBody))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Forbidden')
  })

  it('returns 201 when PRESIDENT uploads valid document', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockCreate.mockResolvedValue(sampleDocument as never)

    const res = await POST(makePostRequest(validDocBody))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBe('doc-1')
  })

  it('writes audit log on successful upload', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockCreate.mockResolvedValue(sampleDocument as never)

    await POST(makePostRequest(validDocBody))
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DOCUMENT_UPLOADED',
        entity: 'Document',
        entityId: 'doc-1',
      })
    )
  })

  it('SUPER_ADMIN can upload document', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u0', role: 'SUPER_ADMIN', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockCreate.mockResolvedValue(sampleDocument as never)

    const res = await POST(makePostRequest(validDocBody))
    expect(res.status).toBe(201)
  })

  it('returns 400 when name is empty', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await POST(makePostRequest({ ...validDocBody, name: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when url is not a valid URL', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await POST(makePostRequest({ ...validDocBody, url: 'not-a-url' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when category is invalid', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await POST(makePostRequest({ ...validDocBody, category: 'INVALID_CATEGORY' }))
    expect(res.status).toBe(400)
  })

  it('accepts optional fileSize', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockCreate.mockResolvedValue({ ...sampleDocument, fileSize: 204800 } as never)

    const res = await POST(makePostRequest({ ...validDocBody, fileSize: 204800 }))
    expect(res.status).toBe(201)
  })

  it('returns 400 when fileSize is not a positive integer', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await POST(makePostRequest({ ...validDocBody, fileSize: -100 }))
    expect(res.status).toBe(400)
  })

  it('accepts all valid document categories', async () => {
    const categories = ['MEETING_MINUTES', 'FINANCIAL_AUDIT', 'MAINTENANCE_CONTRACT', 'INVOICE', 'OTHER']

    for (const category of categories) {
      vi.clearAllMocks()
      mockAuth.mockResolvedValue({
        user: { id: 'u1', role: 'PRESIDENT', unitId: null },
      } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
      mockCreate.mockResolvedValue({ ...sampleDocument, category } as never)
      mockAudit.mockResolvedValue(undefined as never)

      const res = await POST(makePostRequest({ ...validDocBody, category }))
      expect(res.status).toBe(201)
    }
  })
})
