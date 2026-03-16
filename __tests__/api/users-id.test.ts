import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))
vi.mock('@/lib/audit', () => ({ writeAuditLog: vi.fn() }))
vi.mock('@/lib/utils', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  cn: vi.fn(),
  formatCurrency: vi.fn(),
  formatDate: vi.fn(),
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { PATCH } from '@/app/api/users/[id]/route'

const mockAuth = vi.mocked(auth)
const mockFindUnique = vi.mocked(prisma.user.findUnique)
const mockUserUpdate = vi.mocked(prisma.user.update)
const mockWriteAuditLog = vi.mocked(writeAuditLog)

const paramsPromise = Promise.resolve({ id: 'user-1' })

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/users/user-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const existingUser = {
  id: 'user-1',
  name: 'Bob',
  email: 'bob@test.com',
  role: 'RESIDENT',
  unitId: null,
  isActive: true,
  createdAt: new Date(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PATCH /api/users/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await PATCH(makeRequest({ isActive: false }), { params: paramsPromise })
    expect(res.status).toBe(401)
  })

  it('returns 403 when role is RESIDENT', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    const res = await PATCH(makeRequest({ isActive: false }), { params: paramsPromise })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Forbidden')
  })

  it('returns 403 when PRESIDENT tries to change role', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    const res = await PATCH(makeRequest({ role: 'PRESIDENT' }), { params: paramsPromise })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toMatch(/Super Admin/i)
  })

  it('returns 404 when user not found', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(null)
    const res = await PATCH(makeRequest({ isActive: false }), { params: paramsPromise })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('User not found')
  })

  it('returns 200 and updates isActive as PRESIDENT', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(existingUser as never)
    const updatedUser = { ...existingUser, isActive: false }
    mockUserUpdate.mockResolvedValue(updatedUser as never)

    const res = await PATCH(makeRequest({ isActive: false }), { params: paramsPromise })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.isActive).toBe(false)
    expect(mockWriteAuditLog).not.toHaveBeenCalled()
  })

  it('returns 200 and updates unitId as PRESIDENT', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(existingUser as never)
    const updatedUser = { ...existingUser, unitId: 'clunit123456789012345' }
    mockUserUpdate.mockResolvedValue(updatedUser as never)

    const res = await PATCH(makeRequest({ unitId: 'clunit123456789012345' }), { params: paramsPromise })
    expect(res.status).toBe(200)
  })

  it('returns 200 and sets unitId to null as PRESIDENT', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue({ ...existingUser, unitId: 'clunit123456789012345' } as never)
    const updatedUser = { ...existingUser, unitId: null }
    mockUserUpdate.mockResolvedValue(updatedUser as never)

    const res = await PATCH(makeRequest({ unitId: null }), { params: paramsPromise })
    expect(res.status).toBe(200)
  })

  it('SUPER_ADMIN can change role and writes audit log', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'admin-1', role: 'SUPER_ADMIN', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(existingUser as never)
    const updatedUser = { ...existingUser, role: 'PRESIDENT' }
    mockUserUpdate.mockResolvedValue(updatedUser as never)
    mockWriteAuditLog.mockResolvedValue({} as never)

    const res = await PATCH(makeRequest({ role: 'PRESIDENT' }), { params: paramsPromise })
    expect(res.status).toBe(200)
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        action: 'ROLE_CHANGED',
        entity: 'User',
        entityId: 'user-1',
        metadata: { from: 'RESIDENT', to: 'PRESIDENT' },
      })
    )
  })

  it('does not write audit log when role is unchanged', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'admin-1', role: 'SUPER_ADMIN', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(existingUser as never)
    // Same role as existing
    const updatedUser = { ...existingUser, role: 'RESIDENT' }
    mockUserUpdate.mockResolvedValue(updatedUser as never)

    const res = await PATCH(makeRequest({ role: 'RESIDENT' }), { params: paramsPromise })
    expect(res.status).toBe(200)
    expect(mockWriteAuditLog).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid body (bad unitId format)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    // unitId must be cuid or null — "not-a-cuid" is not a valid cuid
    const res = await PATCH(makeRequest({ unitId: 'not-a-cuid' }), { params: paramsPromise })
    expect(res.status).toBe(400)
  })
})
