// PhonePe v1 API — SHA-256 / X-VERIFY based integration
import { createHash } from 'crypto'

function getEnvVars() {
  const merchantId = process.env.PHONEPE_MERCHANT_ID
  const saltKey = process.env.PHONEPE_MERCHANT_KEY
  const saltIndex = process.env.PHONEPE_KEY_INDEX ?? '1'
  const env = process.env.PHONEPE_ENV ?? 'SANDBOX'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (!merchantId || !saltKey) {
    throw new Error('PhonePe env vars not configured (PHONEPE_MERCHANT_ID / PHONEPE_MERCHANT_KEY)')
  }

  return { merchantId, saltKey, saltIndex, env, appUrl }
}

function getBaseUrl(env: string) {
  if (env === 'PRODUCTION') {
    return 'https://api.phonepe.com/apis/hermes'
  }
  return 'https://api-preprod.phonepe.com/apis/pg-sandbox'
}

function buildXVerify(data: string, endpoint: string, saltKey: string, saltIndex: string) {
  const hash = createHash('sha256')
    .update(data + endpoint + saltKey)
    .digest('hex')
  return `${hash}###${saltIndex}`
}

export async function initiatePayment(params: {
  merchantOrderId: string
  amountPaise: number
  redirectUrl: string
}): Promise<string> {
  const { merchantId, saltKey, saltIndex, env, appUrl } = getEnvVars()
  const baseUrl = getBaseUrl(env)

  const payload = {
    merchantId,
    merchantTransactionId: params.merchantOrderId,
    amount: params.amountPaise,
    redirectUrl: params.redirectUrl,
    redirectMode: 'REDIRECT',
    callbackUrl: `${appUrl}/api/webhooks/phonepe`,
    paymentInstrument: { type: 'PAY_PAGE' },
  }

  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64')
  const xVerify = buildXVerify(base64Payload, '/pg/v1/pay', saltKey, saltIndex)

  const res = await fetch(`${baseUrl}/pg/v1/pay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-VERIFY': xVerify,
    },
    body: JSON.stringify({ request: base64Payload }),
  })

  const data = await res.json()

  if (!res.ok || !data.success) {
    throw new Error(`PhonePe initiatePayment failed: ${data.message ?? res.status}`)
  }

  return data.data.instrumentResponse.redirectInfo.url as string
}

export async function getOrderStatus(merchantOrderId: string): Promise<{
  state: 'COMPLETED' | 'FAILED' | 'PENDING'
  transactionId?: string
  paymentMode?: string
}> {
  const { merchantId, saltKey, saltIndex, env } = getEnvVars()
  const baseUrl = getBaseUrl(env)

  const endpoint = `/pg/v1/status/${merchantId}/${merchantOrderId}`
  const xVerify = buildXVerify('', endpoint, saltKey, saltIndex)

  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-VERIFY': xVerify,
      'X-MERCHANT-ID': merchantId,
    },
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(`PhonePe getOrderStatus failed: ${data.message ?? res.status}`)
  }

  const txn = data.data
  let state: 'COMPLETED' | 'FAILED' | 'PENDING' = 'PENDING'
  if (txn?.state === 'COMPLETED') state = 'COMPLETED'
  else if (txn?.state === 'FAILED') state = 'FAILED'

  return {
    state,
    transactionId: txn?.transactionId,
    paymentMode: txn?.paymentInstrument?.type,
  }
}

export async function initiateRefund(params: {
  merchantRefundId: string
  originalMerchantOrderId: string
  amountPaise: number
}): Promise<void> {
  const { merchantId, saltKey, saltIndex, env, appUrl } = getEnvVars()
  const baseUrl = getBaseUrl(env)

  const payload = {
    merchantId,
    merchantTransactionId: params.merchantRefundId,
    originalTransactionId: params.originalMerchantOrderId,
    amount: params.amountPaise,
    callbackUrl: `${appUrl}/api/webhooks/phonepe`,
  }

  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64')
  const xVerify = buildXVerify(base64Payload, '/pg/v1/refund', saltKey, saltIndex)

  const res = await fetch(`${baseUrl}/pg/v1/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-VERIFY': xVerify,
    },
    body: JSON.stringify({ request: base64Payload }),
  })

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(`PhonePe initiateRefund failed: ${(errData as { message?: string }).message ?? res.status}`)
  }
}

// No-op — v1 has no token cache
export function _resetTokenCache() {}
