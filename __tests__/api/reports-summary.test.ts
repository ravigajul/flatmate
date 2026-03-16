import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    payment: {
      aggregate: vi.fn(),
    },
    expense: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    issue: {
      findMany: vi.fn(),
    },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET } from '@/app/api/reports/summary/route'

const mockAuth = vi.mocked(auth)
const mockPaymentAggregate = vi.mocked(prisma.payment.aggregate)
const mockExpenseAggregate = vi.mocked(prisma.expense.aggregate)
const mockExpenseGroupBy = vi.mocked(prisma.expense.groupBy)
const mockIssueFindMany = vi.mocked(prisma.issue.findMany)
const mockExpenseFindMany = vi.mocked(prisma.expense.findMany)

function makeGetRequest(): Request {
  return new Request('http://localhost:3000/api/reports/summary', { method: 'GET' })
}

const defaultPaymentAggregate = { _sum: { amount: 120000 } }
const defaultExpenseAggregate = { _sum: { amount: 45000 } }
const defaultExpenseGroupBy = [
  { category: 'REPAIRS', _sum: { amount: 25000 } },
  { category: 'UTILITIES', _sum: { amount: 20000 } },
]
const defaultIssues = [
  { status: 'OPEN', createdAt: new Date('2024-01-01'), resolvedAt: null },
  { status: 'OPEN', createdAt: new Date('2024-02-01'), resolvedAt: null },
  {
    status: 'RESOLVED',
    createdAt: new Date('2024-01-01'),
    resolvedAt: new Date('2024-01-06'),
  },
  {
    status: 'CLOSED',
    createdAt: new Date('2024-02-01'),
    resolvedAt: new Date('2024-02-11'),
  },
]
const defaultRecentExpenses = [
  {
    id: 'e1',
    amount: 5000,
    category: 'REPAIRS',
    description: 'Fixed pump',
    expenseDate: new Date('2024-03-01'),
  },
]

function setupDefaultMocks() {
  mockPaymentAggregate.mockResolvedValue(defaultPaymentAggregate as never)
  mockExpenseAggregate.mockResolvedValue(defaultExpenseAggregate as never)
  mockExpenseGroupBy.mockResolvedValue(defaultExpenseGroupBy as never)
  mockIssueFindMany.mockResolvedValue(defaultIssues as never)
  mockExpenseFindMany.mockResolvedValue(defaultRecentExpenses as never)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/reports/summary', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 200 with correct shape when authenticated', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    setupDefaultMocks()

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()

    // Check all required top-level fields
    expect(json).toHaveProperty('totalCollected')
    expect(json).toHaveProperty('totalExpenses')
    expect(json).toHaveProperty('balance')
    expect(json).toHaveProperty('expensesByCategory')
    expect(json).toHaveProperty('issueStats')
    expect(json).toHaveProperty('recentExpenses')
  })

  it('calculates correct totalCollected', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    setupDefaultMocks()

    const res = await GET()
    const json = await res.json()
    expect(json.totalCollected).toBe(120000)
  })

  it('calculates correct totalExpenses', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    setupDefaultMocks()

    const res = await GET()
    const json = await res.json()
    expect(json.totalExpenses).toBe(45000)
  })

  it('calculates correct balance (totalCollected - totalExpenses)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    setupDefaultMocks()

    const res = await GET()
    const json = await res.json()
    expect(json.balance).toBe(75000) // 120000 - 45000
  })

  it('returns correct expensesByCategory map', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    setupDefaultMocks()

    const res = await GET()
    const json = await res.json()
    expect(json.expensesByCategory).toEqual({
      REPAIRS: 25000,
      UTILITIES: 20000,
    })
  })

  it('returns correct issueStats shape', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    setupDefaultMocks()

    const res = await GET()
    const json = await res.json()
    expect(json.issueStats).toMatchObject({
      open: expect.any(Number),
      resolved: expect.any(Number),
      total: expect.any(Number),
      avgResolutionDays: expect.any(Number),
    })
  })

  it('counts open/resolved issues correctly', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    setupDefaultMocks()

    const res = await GET()
    const json = await res.json()
    // 2 OPEN, 1 RESOLVED, 1 CLOSED → open=2, resolved=2, total=4
    expect(json.issueStats.open).toBe(2)
    expect(json.issueStats.resolved).toBe(2)
    expect(json.issueStats.total).toBe(4)
  })

  it('calculates avgResolutionDays', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    setupDefaultMocks()

    const res = await GET()
    const json = await res.json()
    // RESOLVED: 5 days, CLOSED: 10 days → avg = 7.5
    expect(json.issueStats.avgResolutionDays).toBe(7.5)
  })

  it('returns recentExpenses array', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    setupDefaultMocks()

    const res = await GET()
    const json = await res.json()
    expect(Array.isArray(json.recentExpenses)).toBe(true)
    expect(json.recentExpenses[0].id).toBe('e1')
  })

  it('handles zero expenses gracefully (no division by zero)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockPaymentAggregate.mockResolvedValue({ _sum: { amount: null } } as never)
    mockExpenseAggregate.mockResolvedValue({ _sum: { amount: null } } as never)
    mockExpenseGroupBy.mockResolvedValue([] as never)
    mockIssueFindMany.mockResolvedValue([] as never)
    mockExpenseFindMany.mockResolvedValue([] as never)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.totalCollected).toBe(0)
    expect(json.totalExpenses).toBe(0)
    expect(json.balance).toBe(0)
    expect(json.issueStats.avgResolutionDays).toBe(0)
  })

  it('handles issues with RESOLVED status but no resolvedAt', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockPaymentAggregate.mockResolvedValue({ _sum: { amount: 0 } } as never)
    mockExpenseAggregate.mockResolvedValue({ _sum: { amount: 0 } } as never)
    mockExpenseGroupBy.mockResolvedValue([] as never)
    mockIssueFindMany.mockResolvedValue([
      { status: 'RESOLVED', createdAt: new Date(), resolvedAt: null },
    ] as never)
    mockExpenseFindMany.mockResolvedValue([] as never)

    const res = await GET()
    const json = await res.json()
    // Issue with RESOLVED but no resolvedAt should not be counted for avg
    expect(json.issueStats.avgResolutionDays).toBe(0)
  })

  it('RESIDENT can also access summary', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    setupDefaultMocks()

    const res = await GET()
    expect(res.status).toBe(200)
  })
})
