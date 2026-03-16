import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    expense: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))
vi.mock('@/lib/audit', () => ({ writeAuditLog: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { GET, POST } from '@/app/api/expenses/route'

const mockAuth = vi.mocked(auth)
const mockFindMany = vi.mocked(prisma.expense.findMany)
const mockCreate = vi.mocked(prisma.expense.create)
const mockAudit = vi.mocked(writeAuditLog)

function makeGetRequest(search = ''): Request {
  return new Request(`http://localhost:3000/api/expenses${search}`, { method: 'GET' })
}

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validExpenseBody = {
  amount: 5000,
  category: 'REPAIRS',
  description: 'Fixed water pump',
  expenseDate: '2024-03-15',
  vendor: 'Sharma Electricals',
}

const sampleExpense = {
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

describe('GET /api/expenses', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns expenses when authenticated', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindMany.mockResolvedValue([sampleExpense] as never)

    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
    expect(json[0].id).toBe('exp-1')
  })

  it('RESIDENT can also GET expenses', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindMany.mockResolvedValue([sampleExpense] as never)

    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
  })

  it('applies category filter when ?category= is provided', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindMany.mockResolvedValue([] as never)

    await GET(makeGetRequest('?category=REPAIRS'))
    const callArg = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(callArg.where.category).toBe('REPAIRS')
  })

  it('applies from date filter when ?from= is provided', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindMany.mockResolvedValue([] as never)

    await GET(makeGetRequest('?from=2024-01-01'))
    const callArg = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect((callArg.where.expenseDate as Record<string, unknown>).gte).toBeInstanceOf(Date)
  })

  it('applies to date filter when ?to= is provided', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindMany.mockResolvedValue([] as never)

    await GET(makeGetRequest('?to=2024-12-31'))
    const callArg = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect((callArg.where.expenseDate as Record<string, unknown>).lte).toBeInstanceOf(Date)
  })

  it('applies both from and to date filters', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindMany.mockResolvedValue([] as never)

    await GET(makeGetRequest('?from=2024-01-01&to=2024-12-31'))
    const callArg = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    const dateFilter = callArg.where.expenseDate as Record<string, unknown>
    expect(dateFilter.gte).toBeInstanceOf(Date)
    expect(dateFilter.lte).toBeInstanceOf(Date)
  })

  it('ignores invalid date strings gracefully', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindMany.mockResolvedValue([] as never)

    await GET(makeGetRequest('?from=not-a-date'))
    const callArg = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    // expenseDate filter should not be set for invalid date
    expect(callArg.where).not.toHaveProperty('expenseDate')
  })
})

describe('POST /api/expenses', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(makePostRequest(validExpenseBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 when RESIDENT tries to create expense', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await POST(makePostRequest(validExpenseBody))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Forbidden')
  })

  it('returns 201 when PRESIDENT creates valid expense', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockCreate.mockResolvedValue(sampleExpense as never)

    const res = await POST(makePostRequest(validExpenseBody))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBe('exp-1')
  })

  it('writes audit log on successful creation', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockCreate.mockResolvedValue(sampleExpense as never)

    await POST(makePostRequest(validExpenseBody))
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EXPENSE_CREATED',
        entity: 'Expense',
        entityId: 'exp-1',
      })
    )
  })

  it('SUPER_ADMIN can create expense', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u0', role: 'SUPER_ADMIN', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockCreate.mockResolvedValue(sampleExpense as never)

    const res = await POST(makePostRequest(validExpenseBody))
    expect(res.status).toBe(201)
  })

  it('returns 400 when amount is negative', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await POST(makePostRequest({ ...validExpenseBody, amount: -100 }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when amount is zero', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await POST(makePostRequest({ ...validExpenseBody, amount: 0 }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when description is missing', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const { description: _d, ...bodyWithoutDesc } = validExpenseBody
    const res = await POST(makePostRequest(bodyWithoutDesc))
    expect(res.status).toBe(400)
  })

  it('returns 400 when description is too short (< 3 chars)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await POST(makePostRequest({ ...validExpenseBody, description: 'ab' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when category is invalid', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await POST(makePostRequest({ ...validExpenseBody, category: 'INVALID_CAT' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when receiptUrl is not a valid URL', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await POST(
      makePostRequest({ ...validExpenseBody, receiptUrl: 'not-a-url' })
    )
    expect(res.status).toBe(400)
  })

  it('allows optional fields to be omitted', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockCreate.mockResolvedValue(sampleExpense as never)

    const minimalBody = {
      amount: 500,
      category: 'UTILITIES',
      description: 'Monthly electricity bill',
      expenseDate: '2024-03-15',
    }
    const res = await POST(makePostRequest(minimalBody))
    expect(res.status).toBe(201)
  })
})
