/**
 * Auth Setup — runs once before all tests.
 *
 * Creates a NextAuth v5 JWT cookie for the resident test account
 * (rkalwaysravi@gmail.com) and saves it as Playwright storageState.
 * This bypasses Google OAuth so tests run without a browser sign-in.
 */
import { test as setup } from '@playwright/test'
import { encode } from 'next-auth/jwt'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

// Load secrets from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const RESIDENT_USER = {
  sub: 'cmmtldtk5000cy71zvzb24omk',
  id: 'cmmtldtk5000cy71zvzb24omk',
  email: 'rkalwaysravi@gmail.com',
  name: 'ravi kumar',
  role: 'RESIDENT',
  unitId: 'cmmsp5dco00007baqcd0h1sob',
  isActive: true,
}

setup('create resident session', async ({ request }) => {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET not found in .env.local')

  const token = await encode({
    token: RESIDENT_USER,
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

  const authDir = path.resolve(__dirname, '.auth')
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true })
  fs.writeFileSync(path.join(authDir, 'resident.json'), JSON.stringify(storageState, null, 2))

  // Verify the session works by hitting the resident dashboard
  const response = await request.get('http://localhost:3000/resident', {
    headers: { Cookie: `authjs.session-token=${token}` },
  })
  if (response.status() !== 200) {
    throw new Error(`Auth setup failed: /resident returned ${response.status()}`)
  }
})
