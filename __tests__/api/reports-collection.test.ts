import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    unit: {
      findMany: vi.fn(),
    },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET } from '@/app/api/reports/collection/route'

const mockAuth = vi.mocked(auth)
const mockUnitFindMany = vi.mocked(prisma.unit.findMany)

function makeGetRequest(search = ''): Request {
  return new Request(`http://localhost:3000/api/reports/collection${search}`, {
    method: 'GET',
  })
}

// Sample unit data with embedded feeSchedules and payments
const unitWithPaidFee = {
  id: 'unit-1',
  flatNumber: 'A101',
  ownerName: 'Ravi Kumar',
  feeSchedules: [
    {
      id: 'fs-1',
      amount: 5000,
      payments: [
        {
          id: 'pay-1',
          status: 'SUCCESS',
          paidAt: new Date('2024-03-10T10:00:00Z'),
        },
      ],
    },
  ],
}

const unitWithPendingFee = {
  id: 'unit-2',
  flatNumber: 'A102',
  ownerName: 'Priya Sharma',
  feeSchedules: [
    {
      id: 'fs-2',
      amount: 5000,
      payments: [],
    },
  ],
}

const unitWithNoFee = {
  id: 'unit-3',
  flatNumber: 'A103',
  ownerName: 'Ajay Patel',
  feeSchedules: [],
}

const unitWithFailedPayment = {
  id: 'unit-4',
  flatNumber: 'A104',
  ownerName: 'Sunita Devi',
  feeSchedules: [
    {
      id: 'fs-4',
      amount: 5000,
      payments: [
        {
          id: 'pay-4',
          status: 'FAILED',
          paidAt: null,
        },
      ],
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/reports/collection', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(makeGetRequest('?month=2024-03'))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 400 when month param is missing', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await GET(makeGetRequest())
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/month/i)
  })

  it('returns 400 when month param is invalid format', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await GET(makeGetRequest('?month=03-2024'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when month is just a year', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await GET(makeGetRequest('?month=2024'))
    expect(res.status).toBe(400)
  })

  it('returns array with PAID status for unit with successful payment', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockUnitFindMany.mockResolvedValue([unitWithPaidFee] as never)

    const res = await GET(makeGetRequest('?month=2024-03'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
    expect(json[0].paymentStatus).toBe('PAID')
    expect(json[0].paidAt).toBeTruthy()
    expect(json[0].feeAmount).toBe(5000)
  })

  it('returns PENDING status for unit with fee but no payment', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockUnitFindMany.mockResolvedValue([unitWithPendingFee] as never)

    const res = await GET(makeGetRequest('?month=2024-03'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json[0].paymentStatus).toBe('PENDING')
    expect(json[0].paidAt).toBeNull()
    expect(json[0].feeAmount).toBe(5000)
  })

  it('returns NO_FEE status for unit with no fee schedule', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockUnitFindMany.mockResolvedValue([unitWithNoFee] as never)

    const res = await GET(makeGetRequest('?month=2024-03'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json[0].paymentStatus).toBe('NO_FEE')
    expect(json[0].feeAmount).toBeNull()
    expect(json[0].paidAt).toBeNull()
  })

  it('returns PENDING status for unit with failed payment', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockUnitFindMany.mockResolvedValue([unitWithFailedPayment] as never)

    const res = await GET(makeGetRequest('?month=2024-03'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json[0].paymentStatus).toBe('PENDING')
  })

  it('returns mixed PAID/PENDING/NO_FEE statuses for multiple units', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockUnitFindMany.mockResolvedValue([
      unitWithPaidFee,
      unitWithPendingFee,
      unitWithNoFee,
    ] as never)

    const res = await GET(makeGetRequest('?month=2024-03'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(3)

    const paidUnit = json.find((r: { unitId: string }) => r.unitId === 'unit-1')
    const pendingUnit = json.find((r: { unitId: string }) => r.unitId === 'unit-2')
    const noFeeUnit = json.find((r: { unitId: string }) => r.unitId === 'unit-3')

    expect(paidUnit.paymentStatus).toBe('PAID')
    expect(pendingUnit.paymentStatus).toBe('PENDING')
    expect(noFeeUnit.paymentStatus).toBe('NO_FEE')
  })

  it('includes unitId, flatNumber, ownerName in response', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockUnitFindMany.mockResolvedValue([unitWithPaidFee] as never)

    const res = await GET(makeGetRequest('?month=2024-03'))
    const json = await res.json()
    expect(json[0]).toMatchObject({
      unitId: 'unit-1',
      flatNumber: 'A101',
      ownerName: 'Ravi Kumar',
    })
  })

  it('returns empty array when no units exist', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockUnitFindMany.mockResolvedValue([] as never)

    const res = await GET(makeGetRequest('?month=2024-03'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual([])
  })

  it('RESIDENT can access collection data', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockUnitFindMany.mockResolvedValue([unitWithPaidFee] as never)

    const res = await GET(makeGetRequest('?month=2024-03'))
    expect(res.status).toBe(200)
  })

  it('handles unit with null ownerName', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockUnitFindMany.mockResolvedValue([{ ...unitWithNoFee, ownerName: null }] as never)

    const res = await GET(makeGetRequest('?month=2024-03'))
    const json = await res.json()
    expect(json[0].ownerName).toBeNull()
  })
})
