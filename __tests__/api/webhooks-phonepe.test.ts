import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHash } from 'crypto'

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

const MERCHANT_KEY = 'test-merchant-key'
const KEY_INDEX = '1'

function makeBase64Response(data: object) {
  return Buffer.from(JSON.stringify(data)).toString('base64')
}

function makeXVerify(base64Response: string) {
  const hash = createHash('sha256').update(base64Response + MERCHANT_KEY).digest('hex')
  return `${hash}###${KEY_INDEX}`
}

function makeWebhookRequest(data: object, options: { badSignature?: boolean } = {}): Request {
  const base64Response = makeBase64Response(data)
  const body = JSON.stringify({ response: base64Response })
  const xVerify = options.badSignature ? 'badsig###1' : makeXVerify(base64Response)

  return new Request('http://localhost:3000/api/webhooks/phonepe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-VERIFY': xVerify },
    body,
  })
}

const completedData = {
  merchantId: 'PGTESTPAYUAT',
  merchantTransactionId: 'flatmate-order-123',
  transactionId: 'T123456789',
  amount: 200000,
  state: 'COMPLETED',
  paymentInstrument: { type: 'UPI_INTENT' },
}

const failedData = {
  merchantId: 'PGTESTPAYUAT',
  merchantTransactionId: 'flatmate-order-123',
  amount: 200000,
  state: 'FAILED',
  responseCode: 'PAYMENT_ERROR',
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
  process.env.PHONEPE_MERCHANT_KEY = MERCHANT_KEY
  process.env.PHONEPE_KEY_INDEX = KEY_INDEX
  mockAudit.mockResolvedValue(undefined as never)
  mockSendReceiptEmail.mockResolvedValue(undefined)
  mockUpdate.mockResolvedValue({ ...samplePayment, status: 'SUCCESS' } as never)
  mockUserFindFirst.mockResolvedValue({ id: 'u1' } as never)
})

afterEach(() => {
  delete process.env.PHONEPE_MERCHANT_KEY
  delete process.env.PHONEPE_KEY_INDEX
})

describe('POST /api/webhooks/phonepe', () => {
  it('returns 400 for invalid X-VERIFY signature', async () => {
    const req = makeWebhookRequest(completedData, { badSignature: true })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('signature')
  })

  it('returns 400 when PHONEPE_MERCHANT_KEY is not set', async () => {
    delete process.env.PHONEPE_MERCHANT_KEY
    const req = makeWebhookRequest(completedData)
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost:3000/api/webhooks/phonepe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-VERIFY': 'any###1' },
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('processes COMPLETED payment with valid signature', async () => {
    mockFindUnique.mockResolvedValue(samplePayment as never)

    const req = makeWebhookRequest(completedData)
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('updates payment to SUCCESS on COMPLETED state', async () => {
    mockFindUnique.mockResolvedValue(samplePayment as never)

    await POST(makeWebhookRequest(completedData))

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-1' },
        data: expect.objectContaining({ status: 'SUCCESS' }),
      })
    )
  })

  it('sets phonePeTxnId from transactionId on success', async () => {
    mockFindUnique.mockResolvedValue(samplePayment as never)

    await POST(makeWebhookRequest(completedData))

    const updateArg = mockUpdate.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(updateArg.data.phonePeTxnId).toBe('T123456789')
  })

  it('sets paymentMethod from paymentInstrument.type', async () => {
    mockFindUnique.mockResolvedValue(samplePayment as never)

    await POST(makeWebhookRequest(completedData))

    const updateArg = mockUpdate.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(updateArg.data.paymentMethod).toBe('UPI_INTENT')
  })

  it('writes PAYMENT_SUCCESS audit log', async () => {
    mockFindUnique.mockResolvedValue(samplePayment as never)

    await POST(makeWebhookRequest(completedData))

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

    await POST(makeWebhookRequest(completedData))

    expect(mockSendReceiptEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'resident@test.com',
        residentName: 'Alice',
        transactionId: 'T123456789',
        monthYear: '2026-03',
      })
    )
  })

  it('updates payment to FAILED on FAILED state', async () => {
    mockFindUnique.mockResolvedValue(samplePayment as never)

    await POST(makeWebhookRequest(failedData))

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-1' },
        data: expect.objectContaining({ status: 'FAILED' }),
      })
    )
  })

  it('sets failureReason from responseCode', async () => {
    mockFindUnique.mockResolvedValue(samplePayment as never)

    await POST(makeWebhookRequest(failedData))

    const updateArg = mockUpdate.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(updateArg.data.failureReason).toBe('PAYMENT_ERROR')
  })

  it('writes PAYMENT_FAILED audit log on failed event', async () => {
    mockFindUnique.mockResolvedValue(samplePayment as never)

    await POST(makeWebhookRequest(failedData))

    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PAYMENT_FAILED',
        entity: 'Payment',
        entityId: 'pay-1',
      })
    )
  })

  it('returns 200 for unknown merchantOrderId (graceful ignore)', async () => {
    mockFindUnique.mockResolvedValue(null)

    const res = await POST(makeWebhookRequest(completedData))
    expect(res.status).toBe(200)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 200 without updating if payment already SUCCESS (idempotency)', async () => {
    mockFindUnique.mockResolvedValue({ ...samplePayment, status: 'SUCCESS' } as never)

    const res = await POST(makeWebhookRequest(completedData))
    expect(res.status).toBe(200)
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockAudit).not.toHaveBeenCalled()
  })

  it('does not send receipt email if no resident email found', async () => {
    mockFindUnique.mockResolvedValue({
      ...samplePayment,
      unit: { residents: [] },
    } as never)

    await POST(makeWebhookRequest(completedData))

    expect(mockSendReceiptEmail).not.toHaveBeenCalled()
  })
})
