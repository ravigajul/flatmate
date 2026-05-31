import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { paymentRatelimit, issueRatelimit } from '@/lib/redis'
import { NextResponse } from 'next/server'
import type { NextAuthRequest } from 'next-auth'

const { auth } = NextAuth(authConfig)

export default auth(async (req: NextAuthRequest) => {
  const { pathname } = req.nextUrl
  const session = req.auth
  const isApiRoute = pathname.startsWith('/api/')

  // Public routes — no auth required
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/api/health' ||
    pathname.startsWith('/api/webhooks')
  ) {
    return NextResponse.next()
  }

  // C2: unauthenticated — return 401 for API, redirect for pages
  if (!session?.user) {
    if (isApiRoute) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const { role, isActive, id } = session.user

  // C2: inactive accounts — return 403 for API, redirect for pages
  if (!isActive) {
    if (isApiRoute) return NextResponse.json({ error: 'Account not active' }, { status: 403 })
    if (!pathname.startsWith('/pending')) return NextResponse.redirect(new URL('/pending', req.url))
    return NextResponse.next()
  }

  // C1: rate-limit payment initiations (5 per 10 min per user)
  if (pathname === '/api/payments/initiate' && req.method === 'POST' && paymentRatelimit) {
    const { success } = await paymentRatelimit.limit(id)
    if (!success) {
      return NextResponse.json({ error: 'Too many payment attempts. Try again later.' }, { status: 429 })
    }
  }

  // C1: rate-limit issue creation (10 per hour per user)
  if (pathname === '/api/issues' && req.method === 'POST' && issueRatelimit) {
    const { success } = await issueRatelimit.limit(id)
    if (!success) {
      return NextResponse.json({ error: 'Too many issue submissions. Try again later.' }, { status: 429 })
    }
  }

  // President-only routes
  if (pathname.startsWith('/president') || pathname.startsWith('/api/president')) {
    if (role !== 'PRESIDENT' && role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/resident', req.url))
    }
  }

  // Super Admin routes
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/resident', req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
