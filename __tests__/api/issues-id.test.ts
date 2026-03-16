import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    issue: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))
vi.mock('@/lib/email', () => ({ sendStatusChangeEmail: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendStatusChangeEmail } from '@/lib/email'
import { GET, PATCH } from '@/app/api/issues/[id]/route'

const mockAuth = vi.mocked(auth)
const mockFindUnique = vi.mocked(prisma.issue.findUnique)
const mockUpdate = vi.mocked(prisma.issue.update)
const mockSendEmail = vi.mocked(sendStatusChangeEmail)

const paramsPromise = Promise.resolve({ id: 'issue-1' })

function makeRequest(method: string, body?: unknown): Request {
  return new Request('http://localhost:3000/api/issues/issue-1', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const baseIssue = {
  id: 'issue-1',
  title: 'Pipe broken',
  status: 'OPEN',
  raisedById: 'resident-1',
  resolvedAt: null,
  closedAt: null,
  raisedBy: { name: 'Bob', email: 'bob@test.com' },
  unit: { flatNumber: 'A101' },
  comments: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSendEmail.mockResolvedValue(undefined)
})

// ---- GET /api/issues/[id] ----
describe('GET /api/issues/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(makeRequest('GET'), { params: paramsPromise })
    expect(res.status).toBe(401)
  })

  it('returns 404 when issue does not exist', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(null)

    const res = await GET(makeRequest('GET'), { params: paramsPromise })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Issue not found')
  })

  it('resident can view their own issue', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'resident-1', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(baseIssue as never)

    const res = await GET(makeRequest('GET'), { params: paramsPromise })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.id).toBe('issue-1')
  })

  it('resident cannot view another resident\'s issue', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'resident-2', role: 'RESIDENT', unitId: 'unit-2' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(baseIssue as never) // raisedById = 'resident-1'

    const res = await GET(makeRequest('GET'), { params: paramsPromise })
    expect(res.status).toBe(403)
  })

  it('president can view any issue', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(baseIssue as never)

    const res = await GET(makeRequest('GET'), { params: paramsPromise })
    expect(res.status).toBe(200)
  })

  it('SUPER_ADMIN can view any issue', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u0', role: 'SUPER_ADMIN', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(baseIssue as never)

    const res = await GET(makeRequest('GET'), { params: paramsPromise })
    expect(res.status).toBe(200)
  })
})

// ---- PATCH /api/issues/[id] — President paths ----
describe('PATCH /api/issues/[id] — president', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await PATCH(makeRequest('PATCH', { status: 'RESOLVED' }), { params: paramsPromise })
    expect(res.status).toBe(401)
  })

  it('returns 404 when issue not found', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(null)

    const res = await PATCH(makeRequest('PATCH', { status: 'RESOLVED' }), { params: paramsPromise })
    expect(res.status).toBe(404)
  })

  it('president sets status to RESOLVED — sets resolvedAt', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(baseIssue as never)
    const updated = { ...baseIssue, status: 'RESOLVED', resolvedAt: new Date() }
    mockUpdate.mockResolvedValue(updated as never)

    const res = await PATCH(makeRequest('PATCH', { status: 'RESOLVED' }), { params: paramsPromise })
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'RESOLVED', resolvedAt: expect.any(Date) }),
      })
    )
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ newStatus: 'RESOLVED', to: 'bob@test.com' })
    )
  })

  it('president sets status to CLOSED — sets closedAt', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(baseIssue as never)
    const updated = { ...baseIssue, status: 'CLOSED', closedAt: new Date() }
    mockUpdate.mockResolvedValue(updated as never)

    const res = await PATCH(makeRequest('PATCH', { status: 'CLOSED' }), { params: paramsPromise })
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CLOSED', closedAt: expect.any(Date) }),
      })
    )
  })

  it('president sets status to ASSIGNED — sends email', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(baseIssue as never)
    const updated = { ...baseIssue, status: 'ASSIGNED' }
    mockUpdate.mockResolvedValue(updated as never)

    await PATCH(makeRequest('PATCH', { status: 'ASSIGNED' }), { params: paramsPromise })
    expect(mockSendEmail).toHaveBeenCalled()
  })

  it('president sets status to IN_PROGRESS — sends email', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(baseIssue as never)
    mockUpdate.mockResolvedValue({ ...baseIssue, status: 'IN_PROGRESS' } as never)

    await PATCH(makeRequest('PATCH', { status: 'IN_PROGRESS' }), { params: paramsPromise })
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ newStatus: 'IN_PROGRESS' })
    )
  })

  it('president updates priority without changing status — no email', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(baseIssue as never)
    mockUpdate.mockResolvedValue({ ...baseIssue, priority: 'CRITICAL' } as never)

    await PATCH(makeRequest('PATCH', { priority: 'CRITICAL' }), { params: paramsPromise })
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('swallows email errors and still returns 200', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(baseIssue as never)
    mockUpdate.mockResolvedValue({ ...baseIssue, status: 'RESOLVED' } as never)
    mockSendEmail.mockRejectedValue(new Error('SMTP failure'))

    const res = await PATCH(makeRequest('PATCH', { status: 'RESOLVED' }), { params: paramsPromise })
    expect(res.status).toBe(200)
  })

  it('returns 400 for invalid president body', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(baseIssue as never)

    const res = await PATCH(makeRequest('PATCH', { status: 'INVALID_STATUS' }), { params: paramsPromise })
    expect(res.status).toBe(400)
  })
})

// ---- PATCH /api/issues/[id] — Resident reopen paths ----
describe('PATCH /api/issues/[id] — resident reopen', () => {
  it('resident can reopen within 48h of resolution', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'resident-1', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const resolvedRecently = {
      ...baseIssue,
      status: 'RESOLVED',
      resolvedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    }
    mockFindUnique.mockResolvedValue(resolvedRecently as never)
    mockUpdate.mockResolvedValue({ ...resolvedRecently, status: 'OPEN', resolvedAt: null } as never)

    const res = await PATCH(makeRequest('PATCH', { reopen: true }), { params: paramsPromise })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('OPEN')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'OPEN', resolvedAt: null }),
      })
    )
  })

  it('returns 403 when resident tries to reopen someone else\'s issue', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'resident-2', role: 'RESIDENT', unitId: 'unit-2' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    // raisedById = 'resident-1', not 'resident-2'
    const resolvedIssue = {
      ...baseIssue,
      status: 'RESOLVED',
      resolvedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    }
    mockFindUnique.mockResolvedValue(resolvedIssue as never)

    const res = await PATCH(makeRequest('PATCH', { reopen: true }), { params: paramsPromise })
    expect(res.status).toBe(403)
  })

  it('returns 422 when issue is not RESOLVED', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'resident-1', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    // Status is OPEN, not RESOLVED
    mockFindUnique.mockResolvedValue({ ...baseIssue, status: 'OPEN' } as never)

    const res = await PATCH(makeRequest('PATCH', { reopen: true }), { params: paramsPromise })
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.error).toMatch(/resolved/i)
  })

  it('returns 422 when reopen window has expired (>48h)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'resident-1', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const resolvedLongAgo = {
      ...baseIssue,
      status: 'RESOLVED',
      resolvedAt: new Date(Date.now() - 50 * 60 * 60 * 1000), // 50 hours ago
    }
    mockFindUnique.mockResolvedValue(resolvedLongAgo as never)

    const res = await PATCH(makeRequest('PATCH', { reopen: true }), { params: paramsPromise })
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.error).toMatch(/48 hours/i)
  })

  it('returns 422 when RESOLVED but resolvedAt is null', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'resident-1', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    mockFindUnique.mockResolvedValue({
      ...baseIssue,
      status: 'RESOLVED',
      resolvedAt: null,
    } as never)

    const res = await PATCH(makeRequest('PATCH', { reopen: true }), { params: paramsPromise })
    expect(res.status).toBe(422)
  })

  it('returns 400 when resident sends invalid reopen body', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'resident-1', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    mockFindUnique.mockResolvedValue({
      ...baseIssue,
      status: 'RESOLVED',
      resolvedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    } as never)

    // reopen must be literal true — sending false should fail
    const res = await PATCH(makeRequest('PATCH', { reopen: false }), { params: paramsPromise })
    expect(res.status).toBe(400)
  })

  it('reopen sends status change email', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'resident-1', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const resolvedRecently = {
      ...baseIssue,
      status: 'RESOLVED',
      resolvedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    }
    mockFindUnique.mockResolvedValue(resolvedRecently as never)
    mockUpdate.mockResolvedValue({ ...resolvedRecently, status: 'OPEN', resolvedAt: null } as never)

    await PATCH(makeRequest('PATCH', { reopen: true }), { params: paramsPromise })
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ newStatus: 'OPEN', to: 'bob@test.com' })
    )
  })
})
