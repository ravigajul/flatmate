import type { NextAuthConfig } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import type { Role } from '@prisma/client'

// Lightweight config — no Prisma adapter, safe for Edge runtime (middleware)
export const authConfig: NextAuthConfig = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
        session.user.unitId = (token.unitId ?? null) as string | null
        session.user.isActive = (token.isActive ?? false) as boolean
      }
      return session
    },
    authorized({ auth }) {
      // Used by middleware to check if user is logged in
      return !!auth?.user
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
}
