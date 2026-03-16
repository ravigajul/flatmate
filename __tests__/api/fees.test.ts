import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    feeSchedule: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    unit: {
      findMany: vi.fn(),
    },
  },
}))
vi.mock('@/lib/audit', () => ({ writeAuditLog: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET, POST } from '@/app/api/fees/route'

const mockAuth = vi.mocked(auth)
const mockFindMany = vi.mocked(prisma.feeSchedule.findMany)
const mockCreateMany = vi.mocked(prisma.feeSchedule.createMany)
const mockUnitFindMany = vi.mocked(prisma.unit.findMany)

function makeGetRequest(search = ''): Request {
  return new Request(`http://localhost:3000/api/fees${search}`, { method: 'GET' })
}

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/fees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const presidentSession = {
  user: { id: 'u1', role: 'PRESIDENT', unitId: null },
} as ReturnType<typeof auth> extends Promise<infer T> ? T : never

const residentSession = {
  user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
} as ReturnType<typeof auth> extends Promise<infer T> ? T : never

const sampleSchedule = {
  id: 'fs-1',
  unitId: 'unit-1',
  amount: 2000,
  lateFee: 200,
  monthYear: '2026-03',
  dueDate: new Date('2026-03-10'),
  createdAt: new Date(),
  updatedAt: new Date(),
  unit: { flatNumber: 'A101', ownerName: 'John Doe' },
  payments: [],
}

const validPostBody = {
  month: '2026-03',
  defaultAmount: 2000,
  lateFee: 200,
  dueDate: '2026-03-10',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/fees', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(makeGetRequest('?month=2026-03'))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 when RESIDENT tries to access', async () => {
    mockAuth.mockResolvedValue(residentSession)
    const res = await GET(makeGetRequest('?month=2026-03'))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Forbidden')
  })

  it('returns 400 when month param is missing', async () => {
    mockAuth.mockResolvedValue(presidentSession)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('month')
  })

  it('returns 200 with schedules for valid month', async () => {
    mockAuth.mockResolvedValue(presidentSession)
    mockFindMany.mockResolvedValue([sampleSchedule] as never)

    const res = await GET(makeGetRequest('?month=2026-03'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
    expect(json[0].id).toBe('fs-1')
  })

  it('SUPER_ADMIN can access fee schedules', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u0', role: 'SUPER_ADMIN', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindMany.mockResolvedValue([sampleSchedule] as never)

    const res = await GET(makeGetRequest('?month=2026-03'))
    expect(res.status).toBe(200)
  })

  it('passes month filter to prisma query', async () => {
    mockAuth.mockResolvedValue(presidentSession)
    mockFindMany.mockResolvedValue([] as never)

    await GET(makeGetRequest('?month=2026-03'))
    const callArg = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(callArg.where.monthYear).toBe('2026-03')
  })
})

describe('POST /api/fees', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(makePostRequest(validPostBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 when RESIDENT tries to generate fees', async () => {
    mockAuth.mockResolvedValue(residentSession)
    const res = await POST(makePostRequest(validPostBody))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Forbidden')
  })

  it('returns 400 when month is missing', async () => {
    mockAuth.mockResolvedValue(presidentSession)
    const { month: _m, ...bodyWithoutMonth } = validPostBody
    const res = await POST(makePostRequest(bodyWithoutMonth))
    expect(res.status).toBe(400)
  })

  it('returns 400 when defaultAmount is missing', async () => {
    mockAuth.mockResolvedValue(presidentSession)
    const { defaultAmount: _a, ...bodyWithoutAmount } = validPostBody
    const res = await POST(makePostRequest(bodyWithoutAmount))
    expect(res.status).toBe(400)
  })

  it('returns 400 when month format is invalid', async () => {
    mockAuth.mockResolvedValue(presidentSession)
    const res = await POST(makePostRequest({ ...validPostBody, month: '2026/03' }))
    expect(res.status).toBe(400)
  })

  it('returns 201 when PRESIDENT generates fees successfully', async () => {
    mockAuth.mockResolvedValue(presidentSession)
    mockUnitFindMany.mockResolvedValue([{ id: 'unit-1' }, { id: 'unit-2' }] as never)
    mockFindMany.mockResolvedValue([] as never) // no existing schedules
    mockCreateMany.mockResolvedValue({ count: 2 } as never)

    const res = await POST(makePostRequest(validPostBody))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.created).toBe(2)
  })

  it('skips units that already have a schedule for the month', async () => {
    mockAuth.mockResolvedValue(presidentSession)
    mockUnitFindMany.mockResolvedValue([{ id: 'unit-1' }, { id: 'unit-2' }] as never)
    // unit-1 already has a schedule
    mockFindMany.mockResolvedValue([{ unitId: 'unit-1' }] as never)
    mockCreateMany.mockResolvedValue({ count: 1 } as never)

    const res = await POST(makePostRequest(validPostBody))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.created).toBe(1)

    // Verify createMany was called with only unit-2
    const callArg = mockCreateMany.mock.calls[0][0] as { data: Array<{ unitId: string }> }
    expect(callArg.data).toHaveLength(1)
    expect(callArg.data[0].unitId).toBe('unit-2')
  })

  it('returns created: 0 when all units already have schedules', async () => {
    mockAuth.mockResolvedValue(presidentSession)
    mockUnitFindMany.mockResolvedValue([{ id: 'unit-1' }] as never)
    mockFindMany.mockResolvedValue([{ unitId: 'unit-1' }] as never)

    const res = await POST(makePostRequest(validPostBody))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.created).toBe(0)
  })

  it('SUPER_ADMIN can generate fees', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u0', role: 'SUPER_ADMIN', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockUnitFindMany.mockResolvedValue([{ id: 'unit-1' }] as never)
    mockFindMany.mockResolvedValue([] as never)
    mockCreateMany.mockResolvedValue({ count: 1 } as never)

    const res = await POST(makePostRequest(validPostBody))
    expect(res.status).toBe(201)
  })
})
