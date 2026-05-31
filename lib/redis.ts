import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Guard against missing/whitespace env vars — the Redis constructor throws at
// module load time if the URL is invalid, which crashes the entire middleware.
const url = (process.env.UPSTASH_REDIS_REST_URL ?? '').trim()
const token = (process.env.UPSTASH_REDIS_REST_TOKEN ?? '').trim()
const configured = url.startsWith('https://') && token.length > 0

const redis = configured ? new Redis({ url, token }) : null

function makeLimiter(prefix: string, limiter: ConstructorParameters<typeof Ratelimit>[0]['limiter']): Ratelimit | null {
  if (!redis) return null
  return new Ratelimit({ redis, limiter, prefix })
}

export const authRatelimit = makeLimiter('rl:auth', Ratelimit.slidingWindow(10, '15 m'))
export const paymentRatelimit = makeLimiter('rl:payment', Ratelimit.slidingWindow(5, '10 m'))
export const issueRatelimit = makeLimiter('rl:issue', Ratelimit.slidingWindow(10, '1 h'))
