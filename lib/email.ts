import nodemailer from 'nodemailer'

const STATUS_LABELS: Record<string, string> = {
  ASSIGNED: 'Assigned to a technician',
  IN_PROGRESS: 'Work has started',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  OPEN: 'Reopened',
}

interface StatusChangeEmailParams {
  to: string
  residentName: string
  issueTitle: string
  newStatus: string
  issueId: string
}

export async function sendStatusChangeEmail({
  to,
  residentName,
  issueTitle,
  newStatus,
  issueId,
}: StatusChangeEmailParams) {
  const gmailUser = process.env.GMAIL_USER
  const gmailPassword = process.env.GMAIL_APP_PASSWORD

  if (!gmailUser || !gmailPassword) {
    return
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPassword,
    },
  })

  const statusLabel = STATUS_LABELS[newStatus] ?? newStatus
  const issueUrl = `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/issues/${issueId}`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Issue Status Update</title>
      </head>
      <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="background-color: #1d4ed8; padding: 24px 32px;">
            <h1 style="color: #ffffff; margin: 0; font-size: 20px;">FlatMate — Issue Update</h1>
          </div>
          <div style="padding: 32px;">
            <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">Hi ${residentName},</p>
            <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
              Your maintenance issue has been updated.
            </p>
            <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
              <p style="color: #6b7280; font-size: 13px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.05em;">Issue</p>
              <p style="color: #111827; font-size: 16px; font-weight: 600; margin: 0 0 16px;">${issueTitle}</p>
              <p style="color: #6b7280; font-size: 13px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.05em;">New Status</p>
              <p style="color: #1d4ed8; font-size: 16px; font-weight: 600; margin: 0;">${statusLabel}</p>
            </div>
            <a href="${issueUrl}" style="display: inline-block; background-color: #1d4ed8; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">View Issue</a>
          </div>
          <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 16px 32px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              This is an automated notification from FlatMate. Please do not reply to this email.
            </p>
          </div>
        </div>
      </body>
    </html>
  `

  await transporter.sendMail({
    from: `"FlatMate" <${gmailUser}>`,
    to,
    subject: `Issue Update: ${issueTitle} — ${statusLabel}`,
    html,
  })
}

interface AnnouncementEmailParams {
  to: string[]
  title: string
  body: string
}

export async function sendAnnouncementEmail({
  to,
  title,
  body,
}: AnnouncementEmailParams) {
  const gmailUser = process.env.GMAIL_USER
  const gmailPassword = process.env.GMAIL_APP_PASSWORD

  if (!gmailUser || !gmailPassword) {
    return
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPassword,
    },
  })

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Announcement</title>
      </head>
      <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="background-color: #1d4ed8; padding: 24px 32px;">
            <h1 style="color: #ffffff; margin: 0; font-size: 20px;">FlatMate — Announcement</h1>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #111827; font-size: 18px; font-weight: 700; margin: 0 0 16px;">${title}</h2>
            <div style="color: #374151; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${body}</div>
          </div>
          <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 16px 32px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              This is an automated notification from FlatMate. Please do not reply to this email.
            </p>
          </div>
        </div>
      </body>
    </html>
  `

  for (const recipient of to) {
    await transporter.sendMail({
      from: `"FlatMate" <${gmailUser}>`,
      to: recipient,
      subject: `[FlatMate] ${title}`,
      html,
    })
  }
}

interface ReceiptEmailParams {
  to: string
  residentName: string
  amount: number // in INR (not paise)
  monthYear: string
  transactionId: string
}

export async function sendReceiptEmail({
  to,
  residentName,
  amount,
  monthYear,
  transactionId,
}: ReceiptEmailParams) {
  const gmailUser = process.env.GMAIL_USER
  const gmailPassword = process.env.GMAIL_APP_PASSWORD

  if (!gmailUser || !gmailPassword) {
    return
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPassword,
    },
  })

  const formattedAmount = `₹${amount.toLocaleString('en-IN')}`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Payment Receipt</title>
      </head>
      <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="background-color: #059669; padding: 24px 32px;">
            <h1 style="color: #ffffff; margin: 0; font-size: 20px;">FlatMate — Payment Receipt</h1>
          </div>
          <div style="padding: 32px;">
            <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">Hi ${residentName},</p>
            <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
              Your maintenance fee payment has been received successfully.
            </p>
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
              <p style="color: #6b7280; font-size: 13px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.05em;">Month</p>
              <p style="color: #111827; font-size: 16px; font-weight: 600; margin: 0 0 16px;">${monthYear}</p>
              <p style="color: #6b7280; font-size: 13px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.05em;">Amount Paid</p>
              <p style="color: #059669; font-size: 24px; font-weight: 700; margin: 0 0 16px;">${formattedAmount}</p>
              <p style="color: #6b7280; font-size: 13px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.05em;">Transaction ID</p>
              <p style="color: #111827; font-size: 14px; font-family: monospace; margin: 0;">${transactionId}</p>
            </div>
            <p style="color: #6b7280; font-size: 13px; margin: 0;">
              Please keep this receipt for your records.
            </p>
          </div>
          <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 16px 32px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              This is an automated notification from FlatMate. Please do not reply to this email.
            </p>
          </div>
        </div>
      </body>
    </html>
  `

  await transporter.sendMail({
    from: `"FlatMate" <${gmailUser}>`,
    to,
    subject: `[FlatMate] Payment Receipt — ${monthYear} (${formattedAmount})`,
    html,
  })
}
