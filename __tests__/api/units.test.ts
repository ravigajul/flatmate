import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

// --- mocks ---
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    unit: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET, POST } from '@/app/api/units/route'

const mockAuth = vi.mocked(auth)
const mockFindMany = vi.mocked(prisma.unit.findMany)
const mockCreate = vi.mocked(prisma.unit.create)

function makeRequest(body?: unknown): Request {
  return new Request('http://localhost:3000/api/units', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

function makeGetRequest(): Request {
  return new Request('http://localhost:3000/api/units', { method: 'GET' })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---- GET /api/units ----
describe('GET /api/units', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns units array when authenticated', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const units = [
      { id: 'unit-1', flatNumber: 'A101', residents: [] },
      { id: 'unit-2', flatNumber: 'A102', residents: [] },
    ]
    mockFindMany.mockResolvedValue(units as never)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual(units)
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { flatNumber: 'asc' } })
    )
  })

  it('returns units array when authenticated as RESIDENT', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindMany.mockResolvedValue([] as never)
    const res = await GET()
    expect(res.status).toBe(200)
  })
})

// ---- POST /api/units ----
describe('POST /api/units', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(makeRequest({ flatNumber: 'A101', floor: 1 }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when role is RESIDENT', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    const res = await POST(makeRequest({ flatNumber: 'A101', floor: 1 }))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Forbidden')
  })

  it('returns 400 when body is missing flatNumber', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    const res = await POST(makeRequest({ floor: 1 }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when floor is negative', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    const res = await POST(makeRequest({ flatNumber: 'A101', floor: -1 }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when flatNumber is empty string', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    const res = await POST(makeRequest({ flatNumber: '', floor: 1 }))
    expect(res.status).toBe(400)
  })

  it('returns 201 with valid minimal body as PRESIDENT', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const createdUnit = { id: 'unit-new', flatNumber: 'B201', floor: 2 }
    mockCreate.mockResolvedValue(createdUnit as never)

    const res = await POST(makeRequest({ flatNumber: 'B201', floor: 2 }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toEqual(createdUnit)
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ flatNumber: 'B201', floor: 2 }),
    })
  })

  it('returns 201 with valid full body as PRESIDENT', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const createdUnit = {
      id: 'unit-new',
      flatNumber: 'B202',
      block: 'B',
      floor: 2,
      areaSqft: 900,
      ownerName: 'Test Owner',
    }
    mockCreate.mockResolvedValue(createdUnit as never)

    const res = await POST(
      makeRequest({
        flatNumber: 'B202',
        block: 'B',
        floor: 2,
        areaSqft: 900,
        ownerName: 'Test Owner',
      })
    )
    expect(res.status).toBe(201)
  })

  it('returns 201 as SUPER_ADMIN', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'SUPER_ADMIN', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    mockCreate.mockResolvedValue({ id: 'unit-new', flatNumber: 'C301', floor: 3 } as never)
    const res = await POST(makeRequest({ flatNumber: 'C301', floor: 3 }))
    expect(res.status).toBe(201)
  })

  it('returns 400 when floor exceeds max (50)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    const res = await POST(makeRequest({ flatNumber: 'A101', floor: 51 }))
    expect(res.status).toBe(400)
  })
})
