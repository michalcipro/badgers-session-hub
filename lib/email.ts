import 'server-only'
import { czTime, usDay, usTime } from './time'

/**
 * Transactional email through Resend.
 *
 * Players read Madison time, so that is what every message leads with; the
 * Prague time is there so nobody has to work out the difference during the
 * weeks when it is 6 hours rather than 7.
 */

type SendArgs = { to: string; subject: string; html: string }

export async function sendEmail({ to, subject, html }: SendArgs): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!key || !from) {
    // Not configured yet — booking must still work, so log and carry on.
    console.warn(`[email] skipped "${subject}" to ${to}: RESEND_API_KEY or EMAIL_FROM missing`)
    return false
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    })
    if (!res.ok) {
      console.error(`[email] Resend returned ${res.status}: ${await res.text()}`)
      return false
    }
    return true
  } catch (err) {
    console.error('[email] send failed', err)
    return false
  }
}

// ------------------------------------------------------------- templates

const SHELL = (heading: string, body: string) => `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1b1716">
  <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#9b928d;margin:0 0 6px">
    Winning Minds &times; Badgers Tennis
  </p>
  <h1 style="font-size:20px;margin:0 0 16px">${heading}</h1>
  ${body}
  <p style="font-size:12px;color:#9b928d;margin-top:28px;border-top:1px solid #e4dfdb;padding-top:14px">
    You are getting this because you have an account in the Session Hub.
  </p>
</div>`

const whenBlock = (startsAt: string, durationMin: number, meetUrl: string | null) => `
  <div style="background:#f3f0ee;border-radius:10px;padding:16px;margin:0 0 16px">
    <div style="font-size:20px;font-weight:700">${usDay(startsAt)} at ${usTime(startsAt)}</div>
    <div style="font-size:13px;color:#6f6662;margin-top:4px">
      ${durationMin} minutes &middot; ${czTime(startsAt)} in Prague
    </div>
  </div>
  ${
    meetUrl
      ? `<p style="margin:0 0 16px"><a href="${meetUrl}" style="background:#a8211f;color:#fff;text-decoration:none;padding:11px 18px;border-radius:7px;display:inline-block;font-weight:600">Join the call</a></p>
         <p style="font-size:12px;color:#6f6662;margin:0 0 16px;word-break:break-all">${meetUrl}</p>`
      : `<p style="font-size:14px;color:#6f6662;margin:0 0 16px">The Google Meet link will be added before the call.</p>`
  }`

export const bookingConfirmation = (
  firstName: string,
  startsAt: string,
  durationMin: number,
  meetUrl: string | null
) => ({
  subject: `Your call is booked — ${usDay(startsAt)} at ${usTime(startsAt)}`,
  html: SHELL(
    `You are booked in, ${firstName}.`,
    whenBlock(startsAt, durationMin, meetUrl) +
      `<p style="font-size:14px;margin:0">We will send a reminder the day before. If something comes up, release the slot in the app so a teammate can take it.</p>`
  ),
})

export const bookingReminder = (
  firstName: string,
  startsAt: string,
  durationMin: number,
  meetUrl: string | null
) => ({
  subject: `Tomorrow: your call at ${usTime(startsAt)}`,
  html: SHELL(
    `See you tomorrow, ${firstName}.`,
    whenBlock(startsAt, durationMin, meetUrl) +
      `<p style="font-size:14px;margin:0">Bring one thing you want to work on.</p>`
  ),
})
