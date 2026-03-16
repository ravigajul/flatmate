import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    announcement: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}))
vi.mock('@/lib/audit', () => ({ writeAuditLog: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { DELETE } from '@/app/api/announcements/[id]/route'

const mockAuth = vi.mocked(auth)
const mockFindUnique = vi.mocked(prisma.announcement.findUnique)
const mockDelete = vi.mocked(prisma.announcement.delete)
const mockAudit = vi.mocked(writeAuditLog)

function makeDeleteRequest(): Request {
  return new Request('http://localhost:3000/api/announcements/ann-1', { method: 'DELETE' })
}

const sampleAnnouncement = {
  id: 'ann-1',
  title: 'Test announcement',
  body: 'Some body text for the announcement',
  attachmentUrl: null,
  postedById: 'u1',
  createdAt: new Date(),
  updatedAt: new Date(),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAudit.mockResolvedValue(undefined as never)
  mockDelete.mockResolvedValue(sampleAnnouncement as never)
})

describe('DELETE /api/announcements/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ id: 'ann-1' }) })
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 when RESIDENT tries to delete', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ id: 'ann-1' }) })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Forbidden')
  })

  it('returns 404 when announcement not found', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(null)

    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ id: 'nonexistent' }) })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Announcement not found')
  })

  it('returns 200 and deletes when PRESIDENT', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(sampleAnnouncement as never)

    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ id: 'ann-1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('writes audit log on successful deletion', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(sampleAnnouncement as never)

    await DELETE(makeDeleteRequest(), { params: Promise.resolve({ id: 'ann-1' }) })
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ANNOUNCEMENT_DELETED',
        entity: 'Announcement',
        entityId: 'ann-1',
      })
    )
  })

  it('SUPER_ADMIN can delete announcement', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u0', role: 'SUPER_ADMIN', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindUnique.mockResolvedValue(sampleAnnouncement as never)

    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ id: 'ann-1' }) })
    expect(res.status).toBe(200)
  })
})
