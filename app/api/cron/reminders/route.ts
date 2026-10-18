import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { bookingReminder, sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

/**
 * Sends the 24-hour reminder. Vercel calls this hourly (see vercel.json)
 * with the CRON_SECRET as a bearer token.
 *
 * It picks up every booking starting within the next 25 hours that has not
 * been reminded yet, so a missed run catches up on the next one instead of
 * dropping the reminder. Each booking is stamped, so nobody is mailed twice.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not set' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const until = new Date(now.getTime() + 25 * 60 * 60 * 1000)

  const { data, error } = await supabase
    .from('bookings')
    .select('id, player_id, slots!inner(starts_at, duration_min, meet_url), profiles!inner(email, first_name)')
    .is('reminder_sent_at', null)
    .gt('slots.starts_at', now.toISOString())
    .lte('slots.starts_at', until.toISOString())

  if (error) {
    console.error('[cron/reminders]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type Row = {
    id: string
    slots: { starts_at: string; duration_min: number; meet_url: string | null }
    profiles: { email: string; first_name: string }
  }

  let sent = 0
  let failed = 0

  for (const row of (data ?? []) as unknown as Row[]) {
    const mail = bookingReminder(
      row.profiles.first_name,
      row.slots.starts_at,
      row.slots.duration_min,
      row.slots.meet_url
    )
    const ok = await sendEmail({ to: row.profiles.email, subject: mail.subject, html: mail.html })
    if (ok) {
      await supabase
        .from('bookings')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', row.id)
      sent++
    } else {
      // Left unstamped on purpose, so the next run tries again.
      failed++
    }
  }

  return NextResponse.json({ checked: data?.length ?? 0, sent, failed })
}
