// PhonePe v2 API — OAuth 2.0 based integration

let cachedToken: { token: string; expiresAt: number } | null = null

function getEnvVars() {
  const clientId = process.env.PHONEPE_CLIENT_ID
  const clientSecret = process.env.PHONEPE_CLIENT_SECRET
  const clientVersion = process.env.PHONEPE_CLIENT_VERSION ?? '1'
  const webhookSecret = process.env.PHONEPE_WEBHOOK_SECRET
  const env = process.env.PHONEPE_ENV ?? 'SANDBOX'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (!clientId || !clientSecret || !webhookSecret) {
    throw new Error('PhonePe env vars not configured')
  }

  return { clientId, clientSecret, clientVersion, webhookSecret, env, appUrl }
}

function getBaseUrls(env: string) {
  if (env === 'PRODUCTION') {
    return {
      authBase: 'https://api.phonepe.com/apis/identity-manager',
      pgBase: 'https://api.phonepe.com/apis/pg',
    }
  }
  // SANDBOX
  return {
    authBase: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
    pgBase: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
  }
}

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token
  }

  const { clientId, clientSecret, clientVersion, env } = getEnvVars()
  const { authBase } = getBaseUrls(env)

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    client_version: clientVersion,
  })

  const res = await fetch(`${authBase}/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PhonePe token fetch failed: ${res.status} ${text}`)
  }

  const data = (await res.json()) as {
    access_token: string
    expires_in: number
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }

  return cachedToken.token
}

export async function initiatePayment(params: {
  merchantOrderId: string
  amountPaise: number
  redirectUrl: string
}): Promise<string> {
  const { env } = getEnvVars()
  const { pgBase } = getBaseUrls(env)
  const token = await getAccessToken()

  const res = await fetch(`${pgBase}/checkout/v2/pay`, {
    method: 'POST',
    headers: {
      Authorization: `O-Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      merchantOrderId: params.merchantOrderId,
      amount: params.amountPaise,
      expireAfter: 1200,
      paymentFlow: {
        type: 'PG_CHECKOUT',
        message: 'Monthly maintenance fee',
        merchantUrls: {
          redirectUrl: params.redirectUrl,
        },
      },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PhonePe initiatePayment failed: ${res.status} ${text}`)
  }

  const data = (await res.json()) as {
    orderId: string
    state: string
    redirectUrl: string
  }

  return data.redirectUrl
}

export async function getOrderStatus(merchantOrderId: string): Promise<{
  state: 'COMPLETED' | 'FAILED' | 'PENDING'
  transactionId?: string
  paymentMode?: string
}> {
  const { env } = getEnvVars()
  const { pgBase } = getBaseUrls(env)
  const token = await getAccessToken()

  const res = await fetch(`${pgBase}/checkout/v2/order/${merchantOrderId}/status`, {
    method: 'GET',
    headers: {
      Authorization: `O-Bearer ${token}`,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PhonePe getOrderStatus failed: ${res.status} ${text}`)
  }

  const data = (await res.json()) as {
    orderId: string
    merchantOrderId: string
    state: 'COMPLETED' | 'FAILED' | 'PENDING'
    amount: number
    payments?: Array<{
      transactionId: string
      paymentMode: string
      amount: number
      state: string
    }>
  }

  const firstPayment = data.payments?.[0]

  return {
    state: data.state,
    transactionId: firstPayment?.transactionId,
    paymentMode: firstPayment?.paymentMode,
  }
}

export async function initiateRefund(params: {
  merchantRefundId: string
  originalMerchantOrderId: string
  amountPaise: number
}): Promise<void> {
  const { env } = getEnvVars()
  const { pgBase } = getBaseUrls(env)
  const token = await getAccessToken()

  const res = await fetch(`${pgBase}/payments/v2/refund`, {
    method: 'POST',
    headers: {
      Authorization: `O-Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      merchantRefundId: params.merchantRefundId,
      originalMerchantOrderId: params.originalMerchantOrderId,
      amount: params.amountPaise,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PhonePe initiateRefund failed: ${res.status} ${text}`)
  }
}

// Export for testing purposes
export function _resetTokenCache() {
  cachedToken = null
}
