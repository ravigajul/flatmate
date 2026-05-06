import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { NextResponse } from 'next/server'
import type { NextAuthRequest } from 'next-auth'

const { auth } = NextAuth(authConfig)

export default auth((req: NextAuthRequest) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // Public routes
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Public API routes
  if (pathname === '/api/webhooks/phonepe' || pathname === '/api/health') {
    return NextResponse.next()
  }

  // Require session for all other routes
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const { role, isActive } = session.user

  // Inactive users wait for president to activate them
  if (!isActive && !pathname.startsWith('/pending')) {
    return NextResponse.redirect(new URL('/pending', req.url))
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
