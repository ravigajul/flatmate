import type { Role } from '@prisma/client'
import type { DefaultSession } from 'next-auth'

// Extend NextAuth session types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: Role
      unitId: string | null
      isActive: boolean
    } & DefaultSession['user']
  }
}
