import { prisma } from './prisma'
import type { Prisma } from '@prisma/client'

interface AuditParams {
  userId: string
  action: string
  entity: string
  entityId: string
  metadata?: Prisma.InputJsonValue
  ipAddress?: string
}

export async function writeAuditLog({
  userId,
  action,
  entity,
  entityId,
  metadata,
  ipAddress,
}: AuditParams) {
  return prisma.auditLog.create({
    data: { userId, action, entity, entityId, metadata, ipAddress },
  })
}
