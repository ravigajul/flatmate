import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
    },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET } from '@/app/api/users/route'

const mockAuth = vi.mocked(auth)
const mockFindMany = vi.mocked(prisma.user.findMany)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/users', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 when role is RESIDENT', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    const res = await GET()
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Forbidden')
  })

  it('returns 200 with users array as PRESIDENT', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const users = [
      { id: 'u1', name: 'Alice', email: 'alice@test.com', role: 'PRESIDENT', isActive: true },
      { id: 'u2', name: 'Bob', email: 'bob@test.com', role: 'RESIDENT', isActive: true },
    ]
    mockFindMany.mockResolvedValue(users as never)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual(users)
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } })
    )
  })

  it('returns 200 with users array as SUPER_ADMIN', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u0', role: 'SUPER_ADMIN', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    mockFindMany.mockResolvedValue([] as never)
    const res = await GET()
    expect(res.status).toBe(200)
  })

  it('includes unit in select when querying', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    mockFindMany.mockResolvedValue([] as never)
    await GET()
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ unit: expect.any(Object) }),
      })
    )
  })
})
