import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Use vi.hoisted so these are available inside vi.mock factory
const { mockSendMail, mockCreateTransport } = vi.hoisted(() => {
  const mockSendMail = vi.fn()
  const mockCreateTransport = vi.fn(() => ({ sendMail: mockSendMail }))
  return { mockSendMail, mockCreateTransport }
})

vi.mock('nodemailer', () => ({
  default: {
    createTransport: mockCreateTransport,
  },
}))

import { sendStatusChangeEmail, sendAnnouncementEmail, sendReceiptEmail } from '@/lib/email'

const baseParams = {
  to: 'resident@test.com',
  residentName: 'Alice',
  issueTitle: 'Broken faucet',
  newStatus: 'RESOLVED',
  issueId: 'issue-abc',
}

beforeEach(() => {
  vi.clearAllMocks()
  // Restore the mock implementation after clearAllMocks
  mockCreateTransport.mockImplementation(() => ({ sendMail: mockSendMail }))
})

afterEach(() => {
  delete process.env.GMAIL_USER
  delete process.env.GMAIL_APP_PASSWORD
  delete process.env.NEXTAUTH_URL
})

describe('sendStatusChangeEmail', () => {
  it('returns without sending when GMAIL_USER is not set', async () => {
    delete process.env.GMAIL_USER
    delete process.env.GMAIL_APP_PASSWORD

    await sendStatusChangeEmail(baseParams)
    expect(mockCreateTransport).not.toHaveBeenCalled()
    expect(mockSendMail).not.toHaveBeenCalled()
  })

  it('returns without sending when GMAIL_APP_PASSWORD is not set', async () => {
    process.env.GMAIL_USER = 'test@gmail.com'
    delete process.env.GMAIL_APP_PASSWORD

    await sendStatusChangeEmail(baseParams)
    expect(mockCreateTransport).not.toHaveBeenCalled()
  })

  it('sends email when both env vars are set', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    mockSendMail.mockResolvedValue({ messageId: 'msg-1' })

    await sendStatusChangeEmail(baseParams)
    expect(mockCreateTransport).toHaveBeenCalledWith({
      service: 'gmail',
      auth: {
        user: 'flatmate@gmail.com',
        pass: 'secret123',
      },
    })
    expect(mockSendMail).toHaveBeenCalledOnce()
  })

  it('sends to the correct recipient', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    mockSendMail.mockResolvedValue({})

    await sendStatusChangeEmail({ ...baseParams, to: 'specific@example.com' })
    const callArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.to).toBe('specific@example.com')
  })

  it('includes issue title in subject', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    mockSendMail.mockResolvedValue({})

    await sendStatusChangeEmail({ ...baseParams, issueTitle: 'Lift not working' })
    const callArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.subject as string).toContain('Lift not working')
  })

  it('uses NEXTAUTH_URL for issue link when set', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    process.env.NEXTAUTH_URL = 'https://flatmate.example.com'
    mockSendMail.mockResolvedValue({})

    await sendStatusChangeEmail(baseParams)
    const callArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.html as string).toContain('https://flatmate.example.com/issues/issue-abc')
  })

  it('falls back to localhost when NEXTAUTH_URL not set', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    delete process.env.NEXTAUTH_URL
    mockSendMail.mockResolvedValue({})

    await sendStatusChangeEmail(baseParams)
    const callArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.html as string).toContain('http://localhost:3000/issues/issue-abc')
  })

  it('renders RESOLVED status label correctly', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    mockSendMail.mockResolvedValue({})

    await sendStatusChangeEmail({ ...baseParams, newStatus: 'RESOLVED' })
    const callArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.html as string).toContain('Resolved')
    expect(callArg.subject as string).toContain('Resolved')
  })

  it('renders ASSIGNED status label correctly', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    mockSendMail.mockResolvedValue({})

    await sendStatusChangeEmail({ ...baseParams, newStatus: 'ASSIGNED' })
    const callArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.html as string).toContain('Assigned to a technician')
  })

  it('renders IN_PROGRESS status label correctly', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    mockSendMail.mockResolvedValue({})

    await sendStatusChangeEmail({ ...baseParams, newStatus: 'IN_PROGRESS' })
    const callArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.html as string).toContain('Work has started')
  })

  it('renders CLOSED status label correctly', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    mockSendMail.mockResolvedValue({})

    await sendStatusChangeEmail({ ...baseParams, newStatus: 'CLOSED' })
    const callArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.html as string).toContain('Closed')
    expect(callArg.subject as string).toContain('Closed')
  })

  it('renders OPEN status label as "Reopened"', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    mockSendMail.mockResolvedValue({})

    await sendStatusChangeEmail({ ...baseParams, newStatus: 'OPEN' })
    const callArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.html as string).toContain('Reopened')
  })

  it('falls back to raw status for unknown status values', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    mockSendMail.mockResolvedValue({})

    await sendStatusChangeEmail({ ...baseParams, newStatus: 'SOME_NEW_STATUS' })
    const callArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.subject as string).toContain('SOME_NEW_STATUS')
  })

  it('includes resident name in HTML body', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    mockSendMail.mockResolvedValue({})

    await sendStatusChangeEmail({ ...baseParams, residentName: 'Charlie' })
    const callArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.html as string).toContain('Charlie')
  })

  it('sends from FlatMate gmail address', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    mockSendMail.mockResolvedValue({})

    await sendStatusChangeEmail(baseParams)
    const callArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.from as string).toContain('flatmate@gmail.com')
    expect(callArg.from as string).toContain('FlatMate')
  })
})

describe('sendAnnouncementEmail', () => {
  it('returns without sending when env vars not set', async () => {
    delete process.env.GMAIL_USER
    delete process.env.GMAIL_APP_PASSWORD

    await sendAnnouncementEmail({
      to: ['r1@test.com', 'r2@test.com'],
      title: 'Test Announcement',
      body: 'This is the body of the announcement.',
    })
    expect(mockCreateTransport).not.toHaveBeenCalled()
    expect(mockSendMail).not.toHaveBeenCalled()
  })

  it('returns without sending when GMAIL_USER is set but GMAIL_APP_PASSWORD is not', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    delete process.env.GMAIL_APP_PASSWORD

    await sendAnnouncementEmail({
      to: ['r1@test.com'],
      title: 'Test Announcement',
      body: 'This is the body of the announcement.',
    })
    expect(mockCreateTransport).not.toHaveBeenCalled()
  })

  it('calls sendMail once per recipient when env vars are set', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    mockSendMail.mockResolvedValue({ messageId: 'msg-1' })

    await sendAnnouncementEmail({
      to: ['r1@test.com', 'r2@test.com', 'r3@test.com'],
      title: 'Water Cut Notice',
      body: 'Water will be cut on Saturday from 9am to 1pm.',
    })
    expect(mockSendMail).toHaveBeenCalledTimes(3)
  })

  it('subject includes the announcement title', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    mockSendMail.mockResolvedValue({})

    await sendAnnouncementEmail({
      to: ['r1@test.com'],
      title: 'AGM on Sunday',
      body: 'Please attend the AGM scheduled this Sunday at 10am in the community hall.',
    })
    const callArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.subject as string).toContain('AGM on Sunday')
    expect(callArg.subject as string).toContain('[FlatMate]')
  })

  it('HTML body includes the announcement body text', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    mockSendMail.mockResolvedValue({})

    const bodyText = 'Maintenance work will be carried out on the rooftop this weekend.'
    await sendAnnouncementEmail({
      to: ['r1@test.com'],
      title: 'Rooftop Maintenance',
      body: bodyText,
    })
    const callArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.html as string).toContain(bodyText)
  })

  it('sends to the correct recipient address', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    mockSendMail.mockResolvedValue({})

    await sendAnnouncementEmail({
      to: ['specific@example.com'],
      title: 'Notice',
      body: 'A detailed notice about upcoming maintenance work.',
    })
    const callArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.to).toBe('specific@example.com')
  })

  it('sends from FlatMate gmail address', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    mockSendMail.mockResolvedValue({})

    await sendAnnouncementEmail({
      to: ['r1@test.com'],
      title: 'Notice',
      body: 'A detailed notice about upcoming maintenance work.',
    })
    const callArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.from as string).toContain('flatmate@gmail.com')
    expect(callArg.from as string).toContain('FlatMate')
  })

  it('does not call sendMail when recipient list is empty', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    mockSendMail.mockResolvedValue({})

    await sendAnnouncementEmail({
      to: [],
      title: 'Notice',
      body: 'A detailed notice about upcoming maintenance work.',
    })
    expect(mockSendMail).not.toHaveBeenCalled()
  })
})

describe('sendReceiptEmail', () => {
  const receiptParams = {
    to: 'resident@test.com',
    residentName: 'Alice',
    amount: 2000,
    monthYear: '2026-03',
    transactionId: 'T123456789',
  }

  it('returns without sending when GMAIL_USER is not set', async () => {
    delete process.env.GMAIL_USER
    delete process.env.GMAIL_APP_PASSWORD

    await sendReceiptEmail(receiptParams)
    expect(mockCreateTransport).not.toHaveBeenCalled()
    expect(mockSendMail).not.toHaveBeenCalled()
  })

  it('returns without sending when GMAIL_APP_PASSWORD is not set', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    delete process.env.GMAIL_APP_PASSWORD

    await sendReceiptEmail(receiptParams)
    expect(mockCreateTransport).not.toHaveBeenCalled()
  })

  it('sends email when both env vars are set', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    mockSendMail.mockResolvedValue({ messageId: 'msg-1' })

    await sendReceiptEmail(receiptParams)
    expect(mockCreateTransport).toHaveBeenCalledOnce()
    expect(mockSendMail).toHaveBeenCalledOnce()
  })

  it('sends to the correct recipient', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    mockSendMail.mockResolvedValue({})

    await sendReceiptEmail({ ...receiptParams, to: 'specific@example.com' })
    const callArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.to).toBe('specific@example.com')
  })

  it('formats amount as ₹ in subject and HTML', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    mockSendMail.mockResolvedValue({})

    await sendReceiptEmail({ ...receiptParams, amount: 2000 })
    const callArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.html as string).toContain('₹')
    expect(callArg.subject as string).toContain('₹')
  })

  it('includes transactionId in HTML body', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    mockSendMail.mockResolvedValue({})

    await sendReceiptEmail({ ...receiptParams, transactionId: 'T-UNIQUE-ID-999' })
    const callArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.html as string).toContain('T-UNIQUE-ID-999')
  })

  it('includes monthYear in HTML body', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    mockSendMail.mockResolvedValue({})

    await sendReceiptEmail({ ...receiptParams, monthYear: '2026-04' })
    const callArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.html as string).toContain('2026-04')
  })

  it('includes resident name in HTML body', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    mockSendMail.mockResolvedValue({})

    await sendReceiptEmail({ ...receiptParams, residentName: 'Charlie' })
    const callArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.html as string).toContain('Charlie')
  })

  it('sends from FlatMate gmail address', async () => {
    process.env.GMAIL_USER = 'flatmate@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'secret123'
    mockSendMail.mockResolvedValue({})

    await sendReceiptEmail(receiptParams)
    const callArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.from as string).toContain('flatmate@gmail.com')
    expect(callArg.from as string).toContain('FlatMate')
  })
})
