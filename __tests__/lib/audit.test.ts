import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'

const mockAuditCreate = vi.mocked(prisma.auditLog.create)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('writeAuditLog', () => {
  it('calls prisma.auditLog.create with required fields', async () => {
    mockAuditCreate.mockResolvedValue({} as never)

    await writeAuditLog({
      userId: 'user-1',
      action: 'ROLE_CHANGED',
      entity: 'User',
      entityId: 'target-user-1',
    })

    expect(mockAuditCreate).toHaveBeenCalledOnce()
    expect(mockAuditCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        action: 'ROLE_CHANGED',
        entity: 'User',
        entityId: 'target-user-1',
        metadata: undefined,
        ipAddress: undefined,
      },
    })
  })

  it('passes through metadata when provided', async () => {
    mockAuditCreate.mockResolvedValue({} as never)

    await writeAuditLog({
      userId: 'user-1',
      action: 'ROLE_CHANGED',
      entity: 'User',
      entityId: 'target-user-1',
      metadata: { from: 'RESIDENT', to: 'PRESIDENT' },
    })

    expect(mockAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: { from: 'RESIDENT', to: 'PRESIDENT' },
      }),
    })
  })

  it('passes through ipAddress when provided', async () => {
    mockAuditCreate.mockResolvedValue({} as never)

    await writeAuditLog({
      userId: 'user-1',
      action: 'UNIT_UPDATED',
      entity: 'Unit',
      entityId: 'unit-1',
      ipAddress: '192.168.1.10',
    })

    expect(mockAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ipAddress: '192.168.1.10',
      }),
    })
  })

  it('passes all fields together correctly', async () => {
    const expectedResult = { id: 'audit-1', createdAt: new Date() }
    mockAuditCreate.mockResolvedValue(expectedResult as never)

    const result = await writeAuditLog({
      userId: 'user-42',
      action: 'PAYMENT_MADE',
      entity: 'Payment',
      entityId: 'payment-99',
      metadata: { amount: 5000, method: 'UPI' },
      ipAddress: '10.0.0.1',
    })

    expect(result).toEqual(expectedResult)
    expect(mockAuditCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-42',
        action: 'PAYMENT_MADE',
        entity: 'Payment',
        entityId: 'payment-99',
        metadata: { amount: 5000, method: 'UPI' },
        ipAddress: '10.0.0.1',
      },
    })
  })

  it('works with different action types', async () => {
    mockAuditCreate.mockResolvedValue({} as never)

    const actions = ['EXPENSE_CREATED', 'EXPENSE_DELETED', 'UNIT_CREATED', 'USER_DEACTIVATED']
    for (const action of actions) {
      await writeAuditLog({
        userId: 'user-1',
        action,
        entity: 'Test',
        entityId: 'entity-1',
      })
    }

    expect(mockAuditCreate).toHaveBeenCalledTimes(4)
  })
})
