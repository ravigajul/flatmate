import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    issue: {
      findUnique: vi.fn(),
    },
    issueComment: {
      create: vi.fn(),
    },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { POST } from '@/app/api/issues/[id]/comments/route'

const mockAuth = vi.mocked(auth)
const mockIssueFindUnique = vi.mocked(prisma.issue.findUnique)
const mockCommentCreate = vi.mocked(prisma.issueComment.create)

const paramsPromise = Promise.resolve({ id: 'issue-1' })

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/issues/issue-1/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const baseIssue = {
  id: 'issue-1',
  raisedById: 'resident-1',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/issues/[id]/comments', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(makeRequest({ text: 'A comment' }), { params: paramsPromise })
    expect(res.status).toBe(401)
  })

  it('returns 404 when issue does not exist', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockIssueFindUnique.mockResolvedValue(null)

    const res = await POST(makeRequest({ text: 'A comment' }), { params: paramsPromise })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Issue not found')
  })

  it('resident can comment on their own issue', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'resident-1', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockIssueFindUnique.mockResolvedValue(baseIssue as never)

    const comment = {
      id: 'comment-1',
      issueId: 'issue-1',
      text: 'A comment',
      author: { name: 'Bob', role: 'RESIDENT' },
    }
    mockCommentCreate.mockResolvedValue(comment as never)

    const res = await POST(makeRequest({ text: 'A comment' }), { params: paramsPromise })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBe('comment-1')
    expect(mockCommentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          issueId: 'issue-1',
          authorId: 'resident-1',
          text: 'A comment',
        }),
      })
    )
  })

  it('resident cannot comment on another resident\'s issue', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'resident-2', role: 'RESIDENT', unitId: 'unit-2' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    // raisedById = 'resident-1', not 'resident-2'
    mockIssueFindUnique.mockResolvedValue(baseIssue as never)

    const res = await POST(makeRequest({ text: 'Snooping' }), { params: paramsPromise })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Forbidden')
  })

  it('president can comment on any issue', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'PRESIDENT', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockIssueFindUnique.mockResolvedValue(baseIssue as never)

    const comment = {
      id: 'comment-2',
      issueId: 'issue-1',
      text: 'Looking into this',
      author: { name: 'President', role: 'PRESIDENT' },
    }
    mockCommentCreate.mockResolvedValue(comment as never)

    const res = await POST(makeRequest({ text: 'Looking into this' }), { params: paramsPromise })
    expect(res.status).toBe(201)
  })

  it('SUPER_ADMIN can comment on any issue', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u0', role: 'SUPER_ADMIN', unitId: null },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockIssueFindUnique.mockResolvedValue(baseIssue as never)
    mockCommentCreate.mockResolvedValue({ id: 'comment-3' } as never)

    const res = await POST(makeRequest({ text: 'Admin note' }), { params: paramsPromise })
    expect(res.status).toBe(201)
  })

  it('returns 400 when text is empty', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'resident-1', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockIssueFindUnique.mockResolvedValue(baseIssue as never)

    const res = await POST(makeRequest({ text: '' }), { params: paramsPromise })
    expect(res.status).toBe(400)
  })

  it('returns 400 when text exceeds 1000 characters', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'resident-1', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockIssueFindUnique.mockResolvedValue(baseIssue as never)

    const longText = 'a'.repeat(1001)
    const res = await POST(makeRequest({ text: longText }), { params: paramsPromise })
    expect(res.status).toBe(400)
  })

  it('accepts text at exactly 1000 characters', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'resident-1', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockIssueFindUnique.mockResolvedValue(baseIssue as never)
    mockCommentCreate.mockResolvedValue({ id: 'comment-x' } as never)

    const maxText = 'a'.repeat(1000)
    const res = await POST(makeRequest({ text: maxText }), { params: paramsPromise })
    expect(res.status).toBe(201)
  })

  it('returns 400 when text field is missing', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'resident-1', role: 'RESIDENT', unitId: 'unit-1' },
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    mockIssueFindUnique.mockResolvedValue(baseIssue as never)

    const res = await POST(makeRequest({}), { params: paramsPromise })
    expect(res.status).toBe(400)
  })
})
