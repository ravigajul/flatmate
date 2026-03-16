import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { initiatePayment, getOrderStatus, initiateRefund, _resetTokenCache } from '@/lib/phonepe'

const mockFetch = vi.fn()
global.fetch = mockFetch

const ENV_VARS = {
  PHONEPE_CLIENT_ID: 'test-client-id',
  PHONEPE_CLIENT_SECRET: 'test-client-secret',
  PHONEPE_CLIENT_VERSION: '1',
  PHONEPE_WEBHOOK_SECRET: 'test-webhook-secret',
  PHONEPE_ENV: 'SANDBOX',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
}

function setEnvVars(vars: Partial<typeof ENV_VARS> = ENV_VARS) {
  Object.entries({ ...ENV_VARS, ...vars }).forEach(([k, v]) => {
    if (v === undefined) {
      delete process.env[k]
    } else {
      process.env[k] = v
    }
  })
}

function clearEnvVars() {
  Object.keys(ENV_VARS).forEach((k) => delete process.env[k])
}

function makeTokenResponse() {
  return {
    ok: true,
    json: async () => ({ access_token: 'test-access-token', expires_in: 3600 }),
    text: async () => '',
  }
}

function makePayResponse() {
  return {
    ok: true,
    json: async () => ({
      orderId: 'OMO123',
      state: 'PENDING',
      redirectUrl: 'https://mercury.phonepe.com/pay?token=abc',
    }),
    text: async () => '',
  }
}

function makeStatusResponse(state: 'COMPLETED' | 'FAILED' | 'PENDING' = 'COMPLETED') {
  return {
    ok: true,
    json: async () => ({
      orderId: 'OMO123',
      merchantOrderId: 'flatmate-test',
      state,
      amount: 200000,
      payments:
        state === 'COMPLETED'
          ? [{ transactionId: 'T123', paymentMode: 'UPI', amount: 200000, state: 'COMPLETED' }]
          : [],
    }),
    text: async () => '',
  }
}

function makeRefundResponse() {
  return {
    ok: true,
    json: async () => ({ success: true }),
    text: async () => '',
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

  it('fetches an OAuth token first', async () => {
    mockFetch
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValueOnce(makePayResponse())

    await initiatePayment({
      merchantOrderId: 'flatmate-test',
      amountPaise: 200000,
      redirectUrl: 'http://localhost:3000/resident/pay/callback',
    })

    // First call should be to token endpoint
    const firstCall = mockFetch.mock.calls[0]
    expect(firstCall[0]).toContain('/v1/oauth/token')
  })

  it('calls the pay endpoint with correct payload', async () => {
    mockFetch
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValueOnce(makePayResponse())

    await initiatePayment({
      merchantOrderId: 'flatmate-test',
      amountPaise: 200000,
      redirectUrl: 'http://localhost:3000/resident/pay/callback',
    })

    const payCall = mockFetch.mock.calls[1]
    expect(payCall[0]).toContain('/checkout/v2/pay')

    const body = JSON.parse(payCall[1].body as string)
    expect(body.merchantOrderId).toBe('flatmate-test')
    expect(body.amount).toBe(200000)
    expect(body.paymentFlow.type).toBe('PG_CHECKOUT')
  })

  it('uses O-Bearer authorization header', async () => {
    mockFetch
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValueOnce(makePayResponse())

    await initiatePayment({
      merchantOrderId: 'flatmate-test',
      amountPaise: 200000,
      redirectUrl: 'http://localhost:3000/resident/pay/callback',
    })

    const payCall = mockFetch.mock.calls[1]
    expect(payCall[1].headers['Authorization']).toBe('O-Bearer test-access-token')
  })

  it('returns the redirectUrl from PhonePe', async () => {
    mockFetch
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValueOnce(makePayResponse())

    const result = await initiatePayment({
      merchantOrderId: 'flatmate-test',
      amountPaise: 200000,
      redirectUrl: 'http://localhost:3000/resident/pay/callback',
    })

    expect(result).toBe('https://mercury.phonepe.com/pay?token=abc')
  })

  it('throws on non-OK response from pay endpoint', async () => {
    mockFetch.mockResolvedValueOnce(makeTokenResponse()).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
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

  it('calls the status endpoint with merchantOrderId', async () => {
    mockFetch
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValueOnce(makeStatusResponse('COMPLETED'))

    await getOrderStatus('flatmate-test')

    const statusCall = mockFetch.mock.calls[1]
    expect(statusCall[0]).toContain('/checkout/v2/order/flatmate-test/status')
  })

  it('returns COMPLETED state and transactionId', async () => {
    mockFetch
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValueOnce(makeStatusResponse('COMPLETED'))

    const result = await getOrderStatus('flatmate-test')
    expect(result.state).toBe('COMPLETED')
    expect(result.transactionId).toBe('T123')
    expect(result.paymentMode).toBe('UPI')
  })

  it('returns FAILED state with no transactionId', async () => {
    mockFetch
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValueOnce(makeStatusResponse('FAILED'))

    const result = await getOrderStatus('flatmate-test')
    expect(result.state).toBe('FAILED')
    expect(result.transactionId).toBeUndefined()
  })

  it('throws on non-OK response from status endpoint', async () => {
    mockFetch.mockResolvedValueOnce(makeTokenResponse()).mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
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

  it('calls the refund endpoint with correct payload', async () => {
    mockFetch
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValueOnce(makeRefundResponse())

    await initiateRefund({
      merchantRefundId: 'flatmate-refund-1',
      originalMerchantOrderId: 'flatmate-order-1',
      amountPaise: 200000,
    })

    const refundCall = mockFetch.mock.calls[1]
    expect(refundCall[0]).toContain('/payments/v2/refund')

    const body = JSON.parse(refundCall[1].body as string)
    expect(body.merchantRefundId).toBe('flatmate-refund-1')
    expect(body.originalMerchantOrderId).toBe('flatmate-order-1')
    expect(body.amount).toBe(200000)
  })

  it('throws on non-OK response from refund endpoint', async () => {
    mockFetch.mockResolvedValueOnce(makeTokenResponse()).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
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

describe('Token caching', () => {
  it('reuses cached token for second call within expiry (fetch called only once for token)', async () => {
    mockFetch
      .mockResolvedValueOnce(makeTokenResponse()) // token fetch
      .mockResolvedValueOnce(makePayResponse()) // first pay call
      .mockResolvedValueOnce(makePayResponse()) // second pay call (reuses token)

    await initiatePayment({
      merchantOrderId: 'flatmate-test-1',
      amountPaise: 200000,
      redirectUrl: 'http://localhost:3000/resident/pay/callback',
    })

    await initiatePayment({
      merchantOrderId: 'flatmate-test-2',
      amountPaise: 200000,
      redirectUrl: 'http://localhost:3000/resident/pay/callback',
    })

    // Token fetch should have been called only once
    const tokenCalls = mockFetch.mock.calls.filter((call) =>
      (call[0] as string).includes('/v1/oauth/token')
    )
    expect(tokenCalls).toHaveLength(1)

    // Pay endpoint should have been called twice
    const payCalls = mockFetch.mock.calls.filter((call) =>
      (call[0] as string).includes('/checkout/v2/pay')
    )
    expect(payCalls).toHaveLength(2)
  })

  it('fetches a new token after cache is reset', async () => {
    mockFetch
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValueOnce(makePayResponse())

    await initiatePayment({
      merchantOrderId: 'flatmate-test-1',
      amountPaise: 200000,
      redirectUrl: 'http://localhost:3000/resident/pay/callback',
    })

    // Reset cache
    _resetTokenCache()

    mockFetch
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValueOnce(makePayResponse())

    await initiatePayment({
      merchantOrderId: 'flatmate-test-2',
      amountPaise: 200000,
      redirectUrl: 'http://localhost:3000/resident/pay/callback',
    })

    // Token should have been fetched twice
    const tokenCalls = mockFetch.mock.calls.filter((call) =>
      (call[0] as string).includes('/v1/oauth/token')
    )
    expect(tokenCalls).toHaveLength(2)
  })
})
