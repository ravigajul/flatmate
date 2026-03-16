import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    announcement: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}))
vi.mock('@/lib/audit', () => ({ writeAuditLog: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendAnnouncementEmail: vi.fn() }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { sendAnnouncementEmail } from '@/lib/email'
import { GET, POST } from '@/app/api/announcements/route'

const mockAuth = vi.mocked(auth)
const mockFindMany = vi.mocked(prisma.announcement.findMany)
const mockCreate = vi.mocked(prisma.announcement.create)
const mockUserFindMany = vi.mocked(prisma.user.findMany)
const mockAudit = vi.mocked(writeAuditLog)
const mockSendAnnouncementEmail = vi.mocked(sendAnnouncementEmail)

function makeGetRequest(): Request {
  return new Request('http://localhost:3000/api/announcements', { method: 'GET' })
}

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/announcements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validBody = {
  title: 'Water supply cut on Saturday',
  body: 'Dear residents, the water supply will be cut from 9am to 1pm on Saturday for pipeline maintenance.',
}

const sampleAnnouncement = {
  id: 'ann-1',
  title: 'Water supply cut on Saturday',
  body: 'Dear residents, the water supply will be cut from 9am to 1pm on Saturday for pipeline maintenance.',
  attachmentUrl: null,
  postedById: 'u1',
  createdAt: new Date(),
  updatedAt: new Date(),
  postedBy: { name: 'Admin User' },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAudit.mockResolvedValue(undefined as never)
  mockSendAnnouncementEmail.mockResolvedValue(undefined)
})

describe('GET /api/announcements', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns announcements array when authenticated', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindMany.mockResolvedValue([sampleAnnouncement] as never)

    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
    expect(json[0].id).toBe('ann-1')
  })

  it('returns 200 for RESIDENT role', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockFindMany.mockResolvedValue([] as never)

    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
  })
})

describe('POST /api/announcements', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(makePostRequest(validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 when RESIDENT tries to post', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await POST(makePostRequest(validBody))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Forbidden')
  })

  it('returns 201 when PRESIDENT posts valid announcement', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockCreate.mockResolvedValue(sampleAnnouncement as never)
    mockUserFindMany.mockResolvedValue([{ email: 'resident@test.com' }] as never)

    const res = await POST(makePostRequest(validBody))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBe('ann-1')
  })

  it('writes audit log on successful creation', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockCreate.mockResolvedValue(sampleAnnouncement as never)
    mockUserFindMany.mockResolvedValue([{ email: 'resident@test.com' }] as never)

    await POST(makePostRequest(validBody))
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ANNOUNCEMENT_CREATED',
        entity: 'Announcement',
        entityId: 'ann-1',
      })
    )
  })

  it('calls sendAnnouncementEmail after creation', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockCreate.mockResolvedValue(sampleAnnouncement as never)
    mockUserFindMany.mockResolvedValue([
      { email: 'r1@test.com' },
      { email: 'r2@test.com' },
    ] as never)

    await POST(makePostRequest(validBody))
    expect(mockSendAnnouncementEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['r1@test.com', 'r2@test.com'],
        title: sampleAnnouncement.title,
        body: sampleAnnouncement.body,
      })
    )
  })

  it('does not send email when no active residents exist', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockCreate.mockResolvedValue(sampleAnnouncement as never)
    mockUserFindMany.mockResolvedValue([] as never)

    await POST(makePostRequest(validBody))
    expect(mockSendAnnouncementEmail).not.toHaveBeenCalled()
  })

  it('SUPER_ADMIN can post announcement', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u0', role: 'SUPER_ADMIN', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockCreate.mockResolvedValue(sampleAnnouncement as never)
    mockUserFindMany.mockResolvedValue([] as never)

    const res = await POST(makePostRequest(validBody))
    expect(res.status).toBe(201)
  })

  it('returns 400 when title is too short (< 3 chars)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await POST(makePostRequest({ ...validBody, title: 'Hi' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when title is too long (> 200 chars)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await POST(makePostRequest({ ...validBody, title: 'A'.repeat(201) }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is too short (< 10 chars)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await POST(makePostRequest({ ...validBody, body: 'Short' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when attachmentUrl is not a valid URL', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

    const res = await POST(makePostRequest({ ...validBody, attachmentUrl: 'not-a-url' }))
    expect(res.status).toBe(400)
  })

  it('accepts valid attachmentUrl', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockCreate.mockResolvedValue({ ...sampleAnnouncement, attachmentUrl: 'https://example.com/doc.pdf' } as never)
    mockUserFindMany.mockResolvedValue([] as never)

    const res = await POST(makePostRequest({ ...validBody, attachmentUrl: 'https://example.com/doc.pdf' }))
    expect(res.status).toBe(201)
  })
})
