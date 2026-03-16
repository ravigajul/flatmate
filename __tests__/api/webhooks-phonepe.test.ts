import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'crypto'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    payment: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
  },
}))
vi.mock('@/lib/audit', () => ({ writeAuditLog: vi.fn() }))
vi.mock('@/lib/email', () => ({
  sendReceiptEmail: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { sendReceiptEmail } from '@/lib/email'
import { POST } from '@/app/api/webhooks/phonepe/route'

const mockFindUnique = vi.mocked(prisma.payment.findUnique)
const mockUpdate = vi.mocked(prisma.payment.update)
const mockUserFindFirst = vi.mocked(prisma.user.findFirst)
const mockAudit = vi.mocked(writeAuditLog)
const mockSendReceiptEmail = vi.mocked(sendReceiptEmail)

const WEBHOOK_SECRET = 'test-webhook-secret-123'

function makeWebhookRequest(
  body: unknown,
  options: { useAuthHeader?: boolean; useSigHeader?: boolean; badSecret?: boolean } = {}
): Request {
  const rawBody = JSON.stringify(body)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (options.useAuthHeader !== false) {
    headers['Authorization'] = options.badSecret ? 'wrong-secret' : WEBHOOK_SECRET
  }

  if (options.useSigHeader) {
    const sig = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('base64')
    headers['X-PHONEPE-SIGNATURE'] = sig
    delete headers['Authorization']
  }

  return new Request('http://localhost:3000/api/webhooks/phonepe', {
    method: 'POST',
    headers,
    body: rawBody,
  })
}

const completedWebhookPayload = {
  type: 'checkout.order.completed',
  payload: {
    merchantOrderId: 'flatmate-order-123',
    orderId: 'OMO123456',
    state: 'COMPLETED',
    amount: 200000, // paise
    payments: [
      {
        transactionId: 'T123456789',
        paymentMode: 'UPI',
        amount: 200000,
        state: 'COMPLETED',
      },
    ],
  },
}

const failedWebhookPayload = {
  type: 'checkout.order.failed',
  payload: {
    merchantOrderId: 'flatmate-order-123',
    orderId: 'OMO123456',
    state: 'FAILED',
    amount: 200000,
    errorCode: 'PAYMENT_ERROR',
    payments: [],
  },
}

const samplePayment = {
  id: 'pay-1',
  unitId: 'unit-1',
  feeScheduleId: 'fs-1',
  amount: 2000,
  lateFeeApplied: 0,
  status: 'PENDING',
  phonePeMerchantOrderId: 'flatmate-order-123',
  feeSchedule: { monthYear: '2026-03' },
  unit: {
    residents: [{ email: 'resident@test.com', name: 'Alice' }],
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.PHONEPE_WEBHOOK_SECRET = WEBHOOK_SECRET
  mockAudit.mockResolvedValue(undefined as never)
  mockSendReceiptEmail.mockResolvedValue(undefined)
  mockUpdate.mockResolvedValue({ ...samplePayment, status: 'SUCCESS' } as never)
  mockUserFindFirst.mockResolvedValue({ id: 'u1' } as never)
})

afterEach(() => {
  delete process.env.PHONEPE_WEBHOOK_SECRET
})

describe('POST /api/webhooks/phonepe', () => {
  it('returns 400 for invalid signature (wrong Authorization header)', async () => {
    const req = makeWebhookRequest(completedWebhookPayload, { badSecret: true })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('signature')
  })

  it('returns 400 when PHONEPE_WEBHOOK_SECRET is not set', async () => {
    delete process.env.PHONEPE_WEBHOOK_SECRET
    const req = makeWebhookRequest(completedWebhookPayload)
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('validates valid Authorization header and processes completed payment', async () => {
    mockFindUnique.mockResolvedValue(samplePayment as never)

    const req = makeWebhookRequest(completedWebhookPayload, { useAuthHeader: true })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('validates valid X-PHONEPE-SIGNATURE header and processes completed payment', async () => {
    mockFindUnique.mockResolvedValue(samplePayment as never)

    const req = makeWebhookRequest(completedWebhookPayload, { useSigHeader: true })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('updates payment to SUCCESS on completed event', async () => {
    mockFindUnique.mockResolvedValue(samplePayment as never)

    const req = makeWebhookRequest(completedWebhookPayload)
    await POST(req)

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-1' },
        data: expect.objectContaining({ status: 'SUCCESS' }),
      })
    )
  })

  it('sets phonePeTxnId on success', async () => {
    mockFindUnique.mockResolvedValue(samplePayment as never)

    const req = makeWebhookRequest(completedWebhookPayload)
    await POST(req)

    const updateArg = mockUpdate.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(updateArg.data.phonePeTxnId).toBe('T123456789')
  })

  it('writes PAYMENT_SUCCESS audit log', async () => {
    mockFindUnique.mockResolvedValue(samplePayment as never)

    const req = makeWebhookRequest(completedWebhookPayload)
    await POST(req)

    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PAYMENT_SUCCESS',
        entity: 'Payment',
        entityId: 'pay-1',
      })
    )
  })

  it('calls sendReceiptEmail on success', async () => {
    mockFindUnique.mockResolvedValue(samplePayment as never)

    const req = makeWebhookRequest(completedWebhookPayload)
    await POST(req)

    expect(mockSendReceiptEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'resident@test.com',
        residentName: 'Alice',
        transactionId: 'T123456789',
        monthYear: '2026-03',
      })
    )
  })

  it('updates payment to FAILED on failed event', async () => {
    mockFindUnique.mockResolvedValue(samplePayment as never)

    const req = makeWebhookRequest(failedWebhookPayload)
    await POST(req)

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-1' },
        data: expect.objectContaining({ status: 'FAILED' }),
      })
    )
  })

  it('writes PAYMENT_FAILED audit log on failed event', async () => {
    mockFindUnique.mockResolvedValue(samplePayment as never)

    const req = makeWebhookRequest(failedWebhookPayload)
    await POST(req)

    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PAYMENT_FAILED',
        entity: 'Payment',
        entityId: 'pay-1',
      })
    )
  })

  it('sets failureReason from errorCode', async () => {
    mockFindUnique.mockResolvedValue(samplePayment as never)

    const req = makeWebhookRequest(failedWebhookPayload)
    await POST(req)

    const updateArg = mockUpdate.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(updateArg.data.failureReason).toBe('PAYMENT_ERROR')
  })

  it('returns 200 for unknown merchantOrderId (graceful ignore)', async () => {
    mockFindUnique.mockResolvedValue(null)

    const req = makeWebhookRequest(completedWebhookPayload)
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 200 without updating if payment already SUCCESS (idempotency)', async () => {
    mockFindUnique.mockResolvedValue({ ...samplePayment, status: 'SUCCESS' } as never)

    const req = makeWebhookRequest(completedWebhookPayload)
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockAudit).not.toHaveBeenCalled()
  })

  it('does not send receipt email if no resident email found', async () => {
    mockFindUnique.mockResolvedValue({
      ...samplePayment,
      unit: { residents: [] },
    } as never)

    const req = makeWebhookRequest(completedWebhookPayload)
    await POST(req)

    expect(mockSendReceiptEmail).not.toHaveBeenCalled()
  })
})
