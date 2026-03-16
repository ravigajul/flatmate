/**
 * Auth Setup — runs once before all tests.
 *
 * Creates NextAuth v5 JWT cookies for:
 *   1. resident test account  → e2e/.auth/resident.json
 *   2. super_admin test account → e2e/.auth/super_admin.json
 *
 * Bypasses Google OAuth so tests run without a browser sign-in.
 */
import { test as setup } from '@playwright/test'
import { encode } from 'next-auth/jwt'
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

// Load secrets from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const prisma = new PrismaClient()

const RESIDENT_USER = {
  sub: 'cmmtldtk5000cy71zvzb24omk',
  id: 'cmmtldtk5000cy71zvzb24omk',
  email: 'rkalwaysravi@gmail.com',
  name: 'ravi kumar',
  role: 'RESIDENT',
  unitId: 'cmmsp5dco00007baqcd0h1sob',
  isActive: true,
}

const SUPER_ADMIN_USER = {
  sub: 'e2e-super-admin-test-user-01',
  id: 'e2e-super-admin-test-user-01',
  email: 'admin@flatmate.test',
  name: 'Test Admin',
  role: 'SUPER_ADMIN',
  unitId: null,
  isActive: true,
}

async function createSession(
  secret: string,
  payload: Record<string, unknown>,
  filename: string,
  authDir: string,
) {
  const token = await encode({
    token: payload,
    secret,
    salt: 'authjs.session-token',
  })

  const storageState = {
    cookies: [
      {
        name: 'authjs.session-token',
        value: token,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax' as const,
        expires: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      },
    ],
    origins: [],
  }

  fs.writeFileSync(path.join(authDir, filename), JSON.stringify(storageState, null, 2))
  return token
}

setup('create resident session', async ({ request }) => {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET not found in .env.local')

  const authDir = path.resolve(__dirname, '.auth')
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true })

  // Ensure the E2E super admin user exists in the DB so API writes don't fail FK constraints
  await prisma.user.upsert({
    where: { id: SUPER_ADMIN_USER.id },
    update: { role: 'SUPER_ADMIN', isActive: true },
    create: {
      id: SUPER_ADMIN_USER.id,
      email: SUPER_ADMIN_USER.email,
      name: SUPER_ADMIN_USER.name,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  })
  await prisma.$disconnect()

  const residentToken = await createSession(secret, RESIDENT_USER, 'resident.json', authDir)
  const adminToken = await createSession(secret, SUPER_ADMIN_USER, 'super_admin.json', authDir)

  // Verify resident session
  const residentRes = await request.get('http://localhost:3000/resident', {
    headers: { Cookie: `authjs.session-token=${residentToken}` },
  })
  if (residentRes.status() !== 200) {
    throw new Error(`Resident auth setup failed: /resident returned ${residentRes.status()}`)
  }

  // Verify super_admin session
  const adminRes = await request.get('http://localhost:3000/president', {
    headers: { Cookie: `authjs.session-token=${adminToken}` },
  })
  if (adminRes.status() !== 200) {
    throw new Error(`Super admin auth setup failed: /president returned ${adminRes.status()}`)
  }
})
