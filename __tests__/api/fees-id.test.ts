import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    feeSchedule: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PATCH } from '@/app/api/fees/[id]/route'

const mockAuth = vi.mocked(auth)
const mockFindUnique = vi.mocked(prisma.feeSchedule.findUnique)
const mockUpdate = vi.mocked(prisma.feeSchedule.update)

function makePatchRequest(id: string, body: unknown): [Request, { params: Promise<{ id: string }> }] {
  return [
    new Request(`http://localhost:3000/api/fees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  ]
}

const presidentSession = {
  user: { id: 'u1', role: 'PRESIDENT', unitId: null },
} as ReturnType<typeof auth> extends Promise<infer T> ? T : never

const residentSession = {
  user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
} as ReturnType<typeof auth> extends Promise<infer T> ? T : never

const sampleSchedule = {
  id: 'fs-1',
  unitId: 'unit-1',
  amount: 2000,
  lateFee: 200,
  monthYear: '2026-03',
  dueDate: new Date('2026-03-10'),
  createdAt: new Date(),
  updatedAt: new Date(),
  unit: { flatNumber: 'A101', ownerName: 'John Doe' },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PATCH /api/fees/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const [req, ctx] = makePatchRequest('fs-1', { amount: 2500 })
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 when RESIDENT tries to update fee schedule', async () => {
    mockAuth.mockResolvedValue(residentSession)
    const [req, ctx] = makePatchRequest('fs-1', { amount: 2500 })
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Forbidden')
  })

  it('returns 404 when fee schedule not found', async () => {
    mockAuth.mockResolvedValue(presidentSession)
    mockFindUnique.mockResolvedValue(null)

    const [req, ctx] = makePatchRequest('non-existent', { amount: 2500 })
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toContain('not found')
  })

  it('returns 200 when PRESIDENT updates fee schedule successfully', async () => {
    mockAuth.mockResolvedValue(presidentSession)
    mockFindUnique.mockResolvedValue(sampleSchedule as never)
    const updatedSchedule = { ...sampleSchedule, amount: 2500, unit: { flatNumber: 'A101', ownerName: 'John Doe' } }
    mockUpdate.mockResolvedValue(updatedSchedule as never)

    const [req, ctx] = makePatchRequest('fs-1', { amount: 2500 })
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.amount).toBe(2500)
  })

  it('returns 400 when amount is negative', async () => {
    mockAuth.mockResolvedValue(presidentSession)
    mockFindUnique.mockResolvedValue(sampleSchedule as never)

    const [req, ctx] = makePatchRequest('fs-1', { amount: -100 })
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(400)
  })

  it('returns 400 when lateFee is negative', async () => {
    mockAuth.mockResolvedValue(presidentSession)
    mockFindUnique.mockResolvedValue(sampleSchedule as never)

    const [req, ctx] = makePatchRequest('fs-1', { lateFee: -50 })
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(400)
  })

  it('allows partial update with only dueDate', async () => {
    mockAuth.mockResolvedValue(presidentSession)
    mockFindUnique.mockResolvedValue(sampleSchedule as never)
    mockUpdate.mockResolvedValue({ ...sampleSchedule, unit: { flatNumber: 'A101', ownerName: 'John Doe' } } as never)

    const [req, ctx] = makePatchRequest('fs-1', { dueDate: '2026-03-15' })
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(200)
  })

  it('SUPER_ADMIN can update fee schedule', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u0', role: 'SUPER_ADMIN', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(sampleSchedule as never)
    mockUpdate.mockResolvedValue({ ...sampleSchedule, unit: { flatNumber: 'A101', ownerName: 'John Doe' } } as never)

    const [req, ctx] = makePatchRequest('fs-1', { amount: 3000 })
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(200)
  })
})
