import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHash } from 'crypto'

import { initiatePayment, getOrderStatus, initiateRefund, _resetTokenCache } from '@/lib/phonepe'

const mockFetch = vi.fn()
global.fetch = mockFetch

const ENV_VARS = {
  PHONEPE_MERCHANT_ID: 'PGTESTPAYUAT',
  PHONEPE_MERCHANT_KEY: 'test-salt-key',
  PHONEPE_KEY_INDEX: '1',
  PHONEPE_ENV: 'SANDBOX',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
}

function setEnvVars(vars: Partial<typeof ENV_VARS> = ENV_VARS) {
  Object.entries({ ...ENV_VARS, ...vars }).forEach(([k, v]) => {
    process.env[k] = v
  })
}

function clearEnvVars() {
  Object.keys(ENV_VARS).forEach((k) => delete process.env[k])
}

function makePayResponse() {
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: {
        instrumentResponse: {
          redirectInfo: { url: 'https://mercury-uat.phonepe.com/pay?token=abc' },
        },
      },
    }),
  }
}

function makePayFailResponse() {
  return {
    ok: true,
    json: async () => ({ success: false, message: 'INVALID_MERCHANT' }),
  }
}

function makeStatusResponse(state: 'COMPLETED' | 'FAILED' | 'PENDING' = 'COMPLETED') {
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: {
        merchantTransactionId: 'flatmate-test',
        transactionId: state === 'COMPLETED' ? 'T123' : undefined,
        state,
        amount: 200000,
        paymentInstrument: state === 'COMPLETED' ? { type: 'UPI_INTENT' } : undefined,
      },
    }),
  }
}

function makeRefundResponse() {
  return {
    ok: true,
    json: async () => ({ success: true }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  _resetTokenCache()
  setEnvVars()
})

afterEach(() => {
  clearEnvVars()
  _resetTokenCache()
})

describe('initiatePayment', () => {
  it('throws when env vars are missing', async () => {
    clearEnvVars()
    await expect(
      initiatePayment({ merchantOrderId: 'test', amountPaise: 100, redirectUrl: 'http://localhost' })
    ).rejects.toThrow('PhonePe env vars not configured')
  })

  it('calls the v1 pay endpoint', async () => {
    mockFetch.mockResolvedValueOnce(makePayResponse())

    await initiatePayment({
      merchantOrderId: 'flatmate-test',
      amountPaise: 200000,
      redirectUrl: 'http://localhost:3000/resident/pay/callback',
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/pg/v1/pay')
  })

  it('sends base64-encoded payload in request body', async () => {
    mockFetch.mockResolvedValueOnce(makePayResponse())

    await initiatePayment({
      merchantOrderId: 'flatmate-test',
      amountPaise: 200000,
      redirectUrl: 'http://localhost:3000/resident/pay/callback',
    })

    const [, init] = mockFetch.mock.calls[0]
    const body = JSON.parse(init.body as string)
    expect(body).toHaveProperty('request')
    const decoded = JSON.parse(Buffer.from(body.request, 'base64').toString('utf-8'))
    expect(decoded.merchantId).toBe('PGTESTPAYUAT')
    expect(decoded.merchantTransactionId).toBe('flatmate-test')
    expect(decoded.amount).toBe(200000)
    expect(decoded.paymentInstrument.type).toBe('PAY_PAGE')
  })

  it('sends a valid X-VERIFY header', async () => {
    mockFetch.mockResolvedValueOnce(makePayResponse())

    await initiatePayment({
      merchantOrderId: 'flatmate-test',
      amountPaise: 200000,
      redirectUrl: 'http://localhost:3000/resident/pay/callback',
    })

    const [, init] = mockFetch.mock.calls[0]
    const body = JSON.parse(init.body as string)
    const base64Payload = body.request as string
    const expectedHash = createHash('sha256')
      .update(base64Payload + '/pg/v1/pay' + 'test-salt-key')
      .digest('hex')
    expect(init.headers['X-VERIFY']).toBe(`${expectedHash}###1`)
  })

  it('returns the redirect URL from PhonePe', async () => {
    mockFetch.mockResolvedValueOnce(makePayResponse())

    const result = await initiatePayment({
      merchantOrderId: 'flatmate-test',
      amountPaise: 200000,
      redirectUrl: 'http://localhost:3000/resident/pay/callback',
    })

    expect(result).toBe('https://mercury-uat.phonepe.com/pay?token=abc')
  })

  it('throws when response success is false', async () => {
    mockFetch.mockResolvedValueOnce(makePayFailResponse())

    await expect(
      initiatePayment({
        merchantOrderId: 'flatmate-test',
        amountPaise: 200000,
        redirectUrl: 'http://localhost:3000/resident/pay/callback',
      })
    ).rejects.toThrow('PhonePe initiatePayment failed')
  })

  it('throws on non-OK HTTP response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Server Error' }),
    })

    await expect(
      initiatePayment({
        merchantOrderId: 'flatmate-test',
        amountPaise: 200000,
        redirectUrl: 'http://localhost:3000/resident/pay/callback',
      })
    ).rejects.toThrow('PhonePe initiatePayment failed')
  })
})

describe('getOrderStatus', () => {
  it('throws when env vars are missing', async () => {
    clearEnvVars()
    await expect(getOrderStatus('flatmate-test')).rejects.toThrow(
      'PhonePe env vars not configured'
    )
  })

  it('calls the v1 status endpoint with merchantId and transactionId', async () => {
    mockFetch.mockResolvedValueOnce(makeStatusResponse('COMPLETED'))

    await getOrderStatus('flatmate-test')

    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/pg/v1/status/PGTESTPAYUAT/flatmate-test')
  })

  it('sends a valid X-VERIFY header for status', async () => {
    mockFetch.mockResolvedValueOnce(makeStatusResponse('COMPLETED'))

    await getOrderStatus('flatmate-test')

    const [, init] = mockFetch.mock.calls[0]
    const endpoint = '/pg/v1/status/PGTESTPAYUAT/flatmate-test'
    const expectedHash = createHash('sha256')
      .update('' + endpoint + 'test-salt-key')
      .digest('hex')
    expect(init.headers['X-VERIFY']).toBe(`${expectedHash}###1`)
  })

  it('returns COMPLETED state with transactionId and paymentMode', async () => {
    mockFetch.mockResolvedValueOnce(makeStatusResponse('COMPLETED'))

    const result = await getOrderStatus('flatmate-test')
    expect(result.state).toBe('COMPLETED')
    expect(result.transactionId).toBe('T123')
    expect(result.paymentMode).toBe('UPI_INTENT')
  })

  it('returns FAILED state', async () => {
    mockFetch.mockResolvedValueOnce(makeStatusResponse('FAILED'))

    const result = await getOrderStatus('flatmate-test')
    expect(result.state).toBe('FAILED')
    expect(result.transactionId).toBeUndefined()
  })

  it('returns PENDING state', async () => {
    mockFetch.mockResolvedValueOnce(makeStatusResponse('PENDING'))

    const result = await getOrderStatus('flatmate-test')
    expect(result.state).toBe('PENDING')
  })

  it('throws on non-OK HTTP response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Not Found' }),
    })

    await expect(getOrderStatus('flatmate-test')).rejects.toThrow('PhonePe getOrderStatus failed')
  })
})

describe('initiateRefund', () => {
  it('throws when env vars are missing', async () => {
    clearEnvVars()
    await expect(
      initiateRefund({
        merchantRefundId: 'flatmate-refund-1',
        originalMerchantOrderId: 'flatmate-order-1',
        amountPaise: 200000,
      })
    ).rejects.toThrow('PhonePe env vars not configured')
  })

  it('calls the v1 refund endpoint', async () => {
    mockFetch.mockResolvedValueOnce(makeRefundResponse())

    await initiateRefund({
      merchantRefundId: 'flatmate-refund-1',
      originalMerchantOrderId: 'flatmate-order-1',
      amountPaise: 200000,
    })

    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/pg/v1/refund')
  })

  it('sends base64-encoded payload with correct fields', async () => {
    mockFetch.mockResolvedValueOnce(makeRefundResponse())

    await initiateRefund({
      merchantRefundId: 'flatmate-refund-1',
      originalMerchantOrderId: 'flatmate-order-1',
      amountPaise: 200000,
    })

    const [, init] = mockFetch.mock.calls[0]
    const body = JSON.parse(init.body as string)
    const decoded = JSON.parse(Buffer.from(body.request, 'base64').toString('utf-8'))
    expect(decoded.merchantTransactionId).toBe('flatmate-refund-1')
    expect(decoded.originalTransactionId).toBe('flatmate-order-1')
    expect(decoded.amount).toBe(200000)
  })

  it('throws on non-OK HTTP response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Bad Request' }),
    })

    await expect(
      initiateRefund({
        merchantRefundId: 'flatmate-refund-1',
        originalMerchantOrderId: 'flatmate-order-1',
        amountPaise: 200000,
      })
    ).rejects.toThrow('PhonePe initiateRefund failed')
  })
})

describe('_resetTokenCache', () => {
  it('is a no-op in v1 (no token cache)', () => {
    expect(() => _resetTokenCache()).not.toThrow()
  })
})
