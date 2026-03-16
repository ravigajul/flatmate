import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    expense: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))
vi.mock('@/lib/audit', () => ({ writeAuditLog: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { PATCH, DELETE } from '@/app/api/expenses/[id]/route'

const mockAuth = vi.mocked(auth)
const mockFindUnique = vi.mocked(prisma.expense.findUnique)
const mockUpdate = vi.mocked(prisma.expense.update)
const mockDelete = vi.mocked(prisma.expense.delete)
const mockAudit = vi.mocked(writeAuditLog)

const paramsPromise = Promise.resolve({ id: 'exp-1' })

function makePatchRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/expenses/exp-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeleteRequest(): Request {
  return new Request('http://localhost:3000/api/expenses/exp-1', {
    method: 'DELETE',
  })
}

const baseExpense = {
  id: 'exp-1',
  amount: 5000,
  category: 'REPAIRS',
  vendor: 'Sharma Electricals',
  description: 'Fixed water pump',
  expenseDate: new Date('2024-03-15'),
  receiptUrl: null,
  addedById: 'u1',
  createdAt: new Date(),
  updatedAt: new Date(),
  addedBy: { name: 'Admin' },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAudit.mockResolvedValue(undefined as never)
})

// ---- PATCH /api/expenses/[id] ----
describe('PATCH /api/expenses/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await PATCH(makePatchRequest({ amount: 6000 }), { params: paramsPromise })
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 when RESIDENT tries to update', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await PATCH(makePatchRequest({ amount: 6000 }), { params: paramsPromise })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Forbidden')
  })

  it('returns 404 when expense not found', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(null)

    const res = await PATCH(makePatchRequest({ amount: 6000 }), { params: paramsPromise })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Expense not found')
  })

  it('returns 200 and updates expense when PRESIDENT provides valid data', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(baseExpense as never)
    const updated = { ...baseExpense, amount: 6000 }
    mockUpdate.mockResolvedValue(updated as never)

    const res = await PATCH(makePatchRequest({ amount: 6000 }), { params: paramsPromise })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.amount).toBe(6000)
  })

  it('writes audit log on successful update', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(baseExpense as never)
    mockUpdate.mockResolvedValue(baseExpense as never)

    await PATCH(makePatchRequest({ amount: 6000 }), { params: paramsPromise })
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EXPENSE_UPDATED',
        entity: 'Expense',
        entityId: 'exp-1',
      })
    )
  })

  it('SUPER_ADMIN can update expense', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u0', role: 'SUPER_ADMIN', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(baseExpense as never)
    mockUpdate.mockResolvedValue(baseExpense as never)

    const res = await PATCH(makePatchRequest({ description: 'Updated desc' }), {
      params: paramsPromise,
    })
    expect(res.status).toBe(200)
  })

  it('returns 400 when amount is negative', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(baseExpense as never)

    const res = await PATCH(makePatchRequest({ amount: -100 }), { params: paramsPromise })
    expect(res.status).toBe(400)
  })

  it('returns 400 when category is invalid', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(baseExpense as never)

    const res = await PATCH(makePatchRequest({ category: 'INVALID' }), {
      params: paramsPromise,
    })
    expect(res.status).toBe(400)
  })

  it('allows partial updates (only some fields)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(baseExpense as never)
    mockUpdate.mockResolvedValue({ ...baseExpense, vendor: 'New Vendor' } as never)

    const res = await PATCH(makePatchRequest({ vendor: 'New Vendor' }), {
      params: paramsPromise,
    })
    expect(res.status).toBe(200)
  })
})

// ---- DELETE /api/expenses/[id] ----
describe('DELETE /api/expenses/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await DELETE(makeDeleteRequest(), { params: paramsPromise })
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 when RESIDENT tries to delete', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await DELETE(makeDeleteRequest(), { params: paramsPromise })
    expect(res.status).toBe(403)
  })

  it('returns 404 when expense not found', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(null)

    const res = await DELETE(makeDeleteRequest(), { params: paramsPromise })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Expense not found')
  })

  it('returns 200 and deletes expense when PRESIDENT', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(baseExpense as never)
    mockDelete.mockResolvedValue(baseExpense as never)

    const res = await DELETE(makeDeleteRequest(), { params: paramsPromise })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('writes audit log on successful deletion', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(baseExpense as never)
    mockDelete.mockResolvedValue(baseExpense as never)

    await DELETE(makeDeleteRequest(), { params: paramsPromise })
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EXPENSE_DELETED',
        entity: 'Expense',
        entityId: 'exp-1',
      })
    )
  })

  it('SUPER_ADMIN can delete expense', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u0', role: 'SUPER_ADMIN', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(baseExpense as never)
    mockDelete.mockResolvedValue(baseExpense as never)

    const res = await DELETE(makeDeleteRequest(), { params: paramsPromise })
    expect(res.status).toBe(200)
  })

  it('calls prisma.expense.delete with correct id', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(baseExpense as never)
    mockDelete.mockResolvedValue(baseExpense as never)

    await DELETE(makeDeleteRequest(), { params: paramsPromise })
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'exp-1' } })
  })
})
