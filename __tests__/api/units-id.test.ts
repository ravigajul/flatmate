import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    unit: {
      update: vi.fn(),
    },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PATCH } from '@/app/api/units/[id]/route'

const mockAuth = vi.mocked(auth)
const mockUpdate = vi.mocked(prisma.unit.update)

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/units/unit-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const paramsPromise = Promise.resolve({ id: 'unit-1' })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PATCH /api/units/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await PATCH(makeRequest({ flatNumber: 'A101' }), { params: paramsPromise })
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 when role is RESIDENT', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    const res = await PATCH(makeRequest({ flatNumber: 'A101' }), { params: paramsPromise })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Forbidden')
  })

  it('returns 400 with invalid data (negative floor)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    const res = await PATCH(makeRequest({ floor: -1 }), { params: paramsPromise })
    expect(res.status).toBe(400)
  })

  it('returns 400 when floor exceeds max', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    const res = await PATCH(makeRequest({ floor: 99 }), { params: paramsPromise })
    expect(res.status).toBe(400)
  })

  it('returns 200 with valid data as PRESIDENT', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const updated = { id: 'unit-1', flatNumber: 'A101', floor: 1, isOccupied: true }
    mockUpdate.mockResolvedValue(updated as never)

    const res = await PATCH(
      makeRequest({ flatNumber: 'A101', floor: 1, isOccupied: true }),
      { params: paramsPromise }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual(updated)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'unit-1' },
      data: expect.objectContaining({ flatNumber: 'A101', floor: 1, isOccupied: true }),
    })
  })

  it('returns 200 as SUPER_ADMIN', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'SUPER_ADMIN', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    mockUpdate.mockResolvedValue({ id: 'unit-1', flatNumber: 'C301' } as never)
    const res = await PATCH(makeRequest({ ownerName: 'New Owner' }), { params: paramsPromise })
    expect(res.status).toBe(200)
  })

  it('returns 400 when flatNumber is empty string', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    const res = await PATCH(makeRequest({ flatNumber: '' }), { params: paramsPromise })
    expect(res.status).toBe(400)
  })
})
