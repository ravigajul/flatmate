import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'
import { authConfig } from './auth.config'
import type { Role } from '@prisma/client'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user || trigger === 'update') {
        const email = user?.email ?? token.email
        if (email) {
          const dbUser = await prisma.user.findUnique({
            where: { email },
            select: { id: true, role: true, unitId: true, isActive: true },
          })
          if (dbUser) {
            token.id = dbUser.id
            token.role = dbUser.role
            token.unitId = dbUser.unitId
            token.isActive = dbUser.isActive
          }
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
        session.user.unitId = (token.unitId ?? null) as string | null
        session.user.isActive = (token.isActive ?? false) as boolean
      }
      return session
    },
  },
})
