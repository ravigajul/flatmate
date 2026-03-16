import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    payment: {
      findMany: vi.fn(),
    },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET } from '@/app/api/payments/history/route'

const mockAuth = vi.mocked(auth)
const mockFindMany = vi.mocked(prisma.payment.findMany)

function makeGetRequest(): Request {
  return new Request('http://localhost:3000/api/payments/history', { method: 'GET' })
}

const residentSession = {
  user: { id: 'u1', role: 'RESIDENT', unitId: 'unit-1' },
} as ReturnType<typeof auth> extends Promise<infer T> ? T : never

const presidentSession = {
  user: { id: 'u2', role: 'PRESIDENT', unitId: null },
} as ReturnType<typeof auth> extends Promise<infer T> ? T : never

const samplePayments = [
  {
    id: 'pay-1',
    unitId: 'unit-1',
    feeScheduleId: 'fs-1',
    amount: 2000,
    lateFeeApplied: 0,
    status: 'SUCCESS',
    paidAt: new Date('2026-03-09'),
    feeSchedule: { monthYear: '2026-03', amount: 2000 },
    unit: { flatNumber: 'A101' },
  },
  {
    id: 'pay-2',
    unitId: 'unit-2',
    feeScheduleId: 'fs-2',
    amount: 2000,
    lateFeeApplied: 0,
    status: 'SUCCESS',
    paidAt: new Date('2026-03-08'),
    feeSchedule: { monthYear: '2026-03', amount: 2000 },
    unit: { flatNumber: 'B201' },
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/payments/history', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('RESIDENT gets only their own payments (filtered by unitId)', async () => {
    mockAuth.mockResolvedValue(residentSession)
    mockFindMany.mockResolvedValue([samplePayments[0]] as never)

    const res = await GET()
    expect(res.status).toBe(200)

    // Verify filter was applied
    const callArg = mockFindMany.mock.calls[0][0] as {
      where: Record<string, unknown>
    }
    expect(callArg.where).toHaveProperty('feeSchedule')
    expect((callArg.where.feeSchedule as Record<string, unknown>).unitId).toBe('unit-1')
  })

  it('PRESIDENT gets all payments without unit filter', async () => {
    mockAuth.mockResolvedValue(presidentSession)
    mockFindMany.mockResolvedValue(samplePayments as never)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(2)

    // Verify no filter was applied
    const callArg = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(callArg.where).toEqual({})
  })

  it('SUPER_ADMIN gets all payments without unit filter', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u0', role: 'SUPER_ADMIN', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindMany.mockResolvedValue(samplePayments as never)

    const res = await GET()
    expect(res.status).toBe(200)

    const callArg = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(callArg.where).toEqual({})
  })

  it('returns payments ordered by createdAt desc', async () => {
    mockAuth.mockResolvedValue(presidentSession)
    mockFindMany.mockResolvedValue(samplePayments as never)

    await GET()
    const callArg = mockFindMany.mock.calls[0][0] as { orderBy: Record<string, unknown> }
    expect(callArg.orderBy).toMatchObject({ createdAt: 'desc' })
  })

  it('includes feeSchedule and unit in response', async () => {
    mockAuth.mockResolvedValue(residentSession)
    mockFindMany.mockResolvedValue([samplePayments[0]] as never)

    const res = await GET()
    const json = await res.json()
    expect(json[0].feeSchedule.monthYear).toBe('2026-03')
    expect(json[0].unit.flatNumber).toBe('A101')
  })
})
