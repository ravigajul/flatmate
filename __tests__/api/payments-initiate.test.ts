import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    feeSchedule: {
      findUnique: vi.fn(),
    },
    payment: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))
vi.mock('@/lib/audit', () => ({ writeAuditLog: vi.fn() }))
vi.mock('@/lib/phonepe', () => ({
  initiatePayment: vi.fn(),
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { initiatePayment } from '@/lib/phonepe'
import { POST } from '@/app/api/payments/initiate/route'

const mockAuth = vi.mocked(auth)
const mockFeeScheduleFindUnique = vi.mocked(prisma.feeSchedule.findUnique)
const mockPaymentFindFirst = vi.mocked(prisma.payment.findFirst)
const mockPaymentCreate = vi.mocked(prisma.payment.create)
const mockAudit = vi.mocked(writeAuditLog)
const mockInitiatePayment = vi.mocked(initiatePayment)

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/payments/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const residentSession = {
  user: { id: 'u1', role: 'RESIDENT', unitId: 'unit-1' },
} as ReturnType<typeof auth> extends Promise<infer T> ? T : never

const residentSessionNoUnit = {
  user: { id: 'u1', role: 'RESIDENT', unitId: null },
} as ReturnType<typeof auth> extends Promise<infer T> ? T : never

const presidentSession = {
  user: { id: 'u2', role: 'PRESIDENT', unitId: null },
} as ReturnType<typeof auth> extends Promise<infer T> ? T : never

const sampleFeeSchedule = {
  id: 'fs-1',
  unitId: 'unit-1',
  amount: 2000,
  lateFee: 200,
  monthYear: '2026-03',
  dueDate: new Date('2099-03-10'), // future date — not late
  createdAt: new Date(),
  updatedAt: new Date(),
}

const lateFeeSchedule = {
  ...sampleFeeSchedule,
  dueDate: new Date('2000-01-01'), // past date — late
}

const samplePayment = {
  id: 'pay-1',
  unitId: 'unit-1',
  feeScheduleId: 'fs-1',
  amount: 2000,
  lateFeeApplied: 0,
  status: 'PENDING',
  phonePeMerchantOrderId: 'flatmate-test-uuid',
  createdAt: new Date(),
  updatedAt: new Date(),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAudit.mockResolvedValue(undefined as never)
})

describe('POST /api/payments/initiate', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(makePostRequest({ feeScheduleId: 'fs-1' }))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 when PRESIDENT tries to initiate payment (resident only)', async () => {
    mockAuth.mockResolvedValue(presidentSession)
    const res = await POST(makePostRequest({ feeScheduleId: 'fs-1' }))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Forbidden')
  })

  it('returns 400 when resident has no unit assigned', async () => {
    mockAuth.mockResolvedValue(residentSessionNoUnit)
    const res = await POST(makePostRequest({ feeScheduleId: 'fs-1' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('unit')
  })

  it('returns 404 when fee schedule not found', async () => {
    mockAuth.mockResolvedValue(residentSession)
    mockFeeScheduleFindUnique.mockResolvedValue(null)
    const res = await POST(makePostRequest({ feeScheduleId: 'non-existent' }))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toContain('not found')
  })

  it('returns 403 when fee schedule belongs to different unit', async () => {
    mockAuth.mockResolvedValue(residentSession)
    mockFeeScheduleFindUnique.mockResolvedValue({
      ...sampleFeeSchedule,
      unitId: 'unit-999', // different unit
    } as never)
    const res = await POST(makePostRequest({ feeScheduleId: 'fs-1' }))
    expect(res.status).toBe(403)
  })

  it('returns 409 when fee is already paid', async () => {
    mockAuth.mockResolvedValue(residentSession)
    mockFeeScheduleFindUnique.mockResolvedValue(sampleFeeSchedule as never)
    mockPaymentFindFirst.mockResolvedValue({ id: 'pay-existing', status: 'SUCCESS' } as never)
    const res = await POST(makePostRequest({ feeScheduleId: 'fs-1' }))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toBe('Already paid')
  })

  it('applies late fee when payment is past due date', async () => {
    mockAuth.mockResolvedValue(residentSession)
    mockFeeScheduleFindUnique.mockResolvedValue(lateFeeSchedule as never)
    mockPaymentFindFirst.mockResolvedValue(null)
    mockPaymentCreate.mockResolvedValue({ ...samplePayment, lateFeeApplied: 200 } as never)
    mockInitiatePayment.mockResolvedValue('https://mercury.phonepe.com/pay?token=xxx')

    await POST(makePostRequest({ feeScheduleId: 'fs-1' }))

    const createArg = mockPaymentCreate.mock.calls[0][0] as { data: { lateFeeApplied: number } }
    expect(createArg.data.lateFeeApplied).toBe(200)
  })

  it('does NOT apply late fee when payment is within due date', async () => {
    mockAuth.mockResolvedValue(residentSession)
    mockFeeScheduleFindUnique.mockResolvedValue(sampleFeeSchedule as never)
    mockPaymentFindFirst.mockResolvedValue(null)
    mockPaymentCreate.mockResolvedValue(samplePayment as never)
    mockInitiatePayment.mockResolvedValue('https://mercury.phonepe.com/pay?token=xxx')

    await POST(makePostRequest({ feeScheduleId: 'fs-1' }))

    const createArg = mockPaymentCreate.mock.calls[0][0] as { data: { lateFeeApplied: number } }
    expect(createArg.data.lateFeeApplied).toBe(0)
  })

  it('creates a Payment record with PENDING status', async () => {
    mockAuth.mockResolvedValue(residentSession)
    mockFeeScheduleFindUnique.mockResolvedValue(sampleFeeSchedule as never)
    mockPaymentFindFirst.mockResolvedValue(null)
    mockPaymentCreate.mockResolvedValue(samplePayment as never)
    mockInitiatePayment.mockResolvedValue('https://mercury.phonepe.com/pay?token=xxx')

    await POST(makePostRequest({ feeScheduleId: 'fs-1' }))

    const createArg = mockPaymentCreate.mock.calls[0][0] as { data: { status: string } }
    expect(createArg.data.status).toBe('PENDING')
  })

  it('writes audit log with PAYMENT_INITIATED action', async () => {
    mockAuth.mockResolvedValue(residentSession)
    mockFeeScheduleFindUnique.mockResolvedValue(sampleFeeSchedule as never)
    mockPaymentFindFirst.mockResolvedValue(null)
    mockPaymentCreate.mockResolvedValue(samplePayment as never)
    mockInitiatePayment.mockResolvedValue('https://mercury.phonepe.com/pay?token=xxx')

    await POST(makePostRequest({ feeScheduleId: 'fs-1' }))

    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PAYMENT_INITIATED',
        entity: 'Payment',
      })
    )
  })

  it('calls initiatePayment with correct amountPaise', async () => {
    mockAuth.mockResolvedValue(residentSession)
    mockFeeScheduleFindUnique.mockResolvedValue(sampleFeeSchedule as never) // amount=2000, lateFee=200
    mockPaymentFindFirst.mockResolvedValue(null)
    mockPaymentCreate.mockResolvedValue(samplePayment as never)
    mockInitiatePayment.mockResolvedValue('https://mercury.phonepe.com/pay?token=xxx')

    await POST(makePostRequest({ feeScheduleId: 'fs-1' }))

    expect(mockInitiatePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amountPaise: 200000, // 2000 * 100 (no late fee since not past due)
      })
    )
  })

  it('returns redirectUrl and paymentId on success', async () => {
    mockAuth.mockResolvedValue(residentSession)
    mockFeeScheduleFindUnique.mockResolvedValue(sampleFeeSchedule as never)
    mockPaymentFindFirst.mockResolvedValue(null)
    mockPaymentCreate.mockResolvedValue(samplePayment as never)
    mockInitiatePayment.mockResolvedValue('https://mercury.phonepe.com/pay?token=xxx')

    const res = await POST(makePostRequest({ feeScheduleId: 'fs-1' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.redirectUrl).toBe('https://mercury.phonepe.com/pay?token=xxx')
    expect(json.paymentId).toBe('pay-1')
  })
})
