import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    issue: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET, POST } from '@/app/api/issues/route'

const mockAuth = vi.mocked(auth)
const mockFindMany = vi.mocked(prisma.issue.findMany)
const mockCreate = vi.mocked(prisma.issue.create)

function makeGetRequest(search = ''): Request {
  return new Request(`http://localhost:3000/api/issues${search}`, { method: 'GET' })
}

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validIssueBody = {
  title: 'Leak in bathroom',
  description: 'There is a water leak under the sink that needs immediate attention.',
  category: 'PLUMBING',
  priority: 'HIGH',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/issues', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('PRESIDENT sees all issues (no raisedById filter)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindMany.mockResolvedValue([{ id: 'i1' }, { id: 'i2' }] as never)

    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(2)

    // No raisedById filter should be in where
    const callArg = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(callArg.where).not.toHaveProperty('raisedById')
  })

  it('PRESIDENT can filter by ?status=OPEN', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindMany.mockResolvedValue([] as never)

    await GET(makeGetRequest('?status=OPEN'))
    const callArg = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(callArg.where.status).toBe('OPEN')
  })

  it('PRESIDENT can filter by ?category=PLUMBING', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindMany.mockResolvedValue([] as never)

    await GET(makeGetRequest('?category=PLUMBING'))
    const callArg = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(callArg.where.category).toBe('PLUMBING')
  })

  it('PRESIDENT can filter by ?priority=CRITICAL', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindMany.mockResolvedValue([] as never)

    await GET(makeGetRequest('?priority=CRITICAL'))
    const callArg = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(callArg.where.priority).toBe('CRITICAL')
  })

  it('RESIDENT sees only own issues (raisedById filter)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'resident-1', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindMany.mockResolvedValue([{ id: 'i1', raisedById: 'resident-1' }] as never)

    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    const callArg = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(callArg.where.raisedById).toBe('resident-1')
  })

  it('SUPER_ADMIN sees all issues', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u0', role: 'SUPER_ADMIN', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindMany.mockResolvedValue([] as never)

    await GET(makeGetRequest())
    const callArg = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(callArg.where).not.toHaveProperty('raisedById')
  })
})

describe('POST /api/issues', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(makePostRequest(validIssueBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 when user has no unitId', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    const res = await POST(makePostRequest(validIssueBody))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toMatch(/unit/i)
  })

  it('returns 400 when category is invalid', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    const res = await POST(makePostRequest({ ...validIssueBody, category: 'INVALID_CAT' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when title is too short', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    const res = await POST(makePostRequest({ ...validIssueBody, title: 'ab' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when description is too short', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    const res = await POST(makePostRequest({ ...validIssueBody, description: 'short' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when priority is invalid', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    const res = await POST(makePostRequest({ ...validIssueBody, priority: 'URGENT' }))
    expect(res.status).toBe(400)
  })

  it('returns 201 with valid body', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const createdIssue = {
      id: 'issue-1',
      title: validIssueBody.title,
      category: 'PLUMBING',
      status: 'OPEN',
      unit: { flatNumber: 'A101' },
      raisedBy: { name: 'Bob', email: 'bob@test.com' },
      _count: { comments: 0 },
    }
    mockCreate.mockResolvedValue(createdIssue as never)

    const res = await POST(makePostRequest(validIssueBody))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBe('issue-1')
  })

  it('defaults priority to MEDIUM when not specified', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const bodyWithoutPriority = {
      title: 'No priority specified issue',
      description: 'This is a test description that is long enough.',
      category: 'ELECTRICAL',
    }

    mockCreate.mockResolvedValue({ id: 'issue-2', priority: 'MEDIUM' } as never)
    const res = await POST(makePostRequest(bodyWithoutPriority))
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priority: 'MEDIUM' }),
      })
    )
  })

  it('accepts up to 3 photoUrls', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    mockCreate.mockResolvedValue({ id: 'issue-3' } as never)
    const res = await POST(
      makePostRequest({
        ...validIssueBody,
        photoUrls: ['http://a.com/1.jpg', 'http://a.com/2.jpg', 'http://a.com/3.jpg'],
      })
    )
    expect(res.status).toBe(201)
  })

  it('returns 400 when photoUrls has more than 3 items', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await POST(
      makePostRequest({
        ...validIssueBody,
        photoUrls: ['a', 'b', 'c', 'd'],
      })
    )
    expect(res.status).toBe(400)
  })
})
