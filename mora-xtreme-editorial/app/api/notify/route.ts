import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    const { to_email, subject, message, taskUrl } = await req.json()

    const htmlBody = `
      <div style="font-family: sans-serif; color: #333; max-width: 600px; padding: 20px;">
        <p style="font-size: 16px; line-height: 1.5;">${message}</p>
        ${taskUrl ? `
          <div style="margin-top: 30px;">
            <a href="${taskUrl}" style="background-color: #2563EB; color: white; padding: 12px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              View Task in Dashboard
            </a>
          </div>
        ` : ''}
      </div>
    `

    await resend.emails.send({
      from: 'Mora Xtreme <onboarding@resend.dev>',
      to: to_email,
      subject: subject,
      html: htmlBody
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}