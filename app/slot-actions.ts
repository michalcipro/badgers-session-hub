'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireActive } from '@/lib/auth'
import { bookingConfirmation, sendEmail } from '@/lib/email'
import { TZ_CZ, addDays, dayStart, mondayOf, ymd, zonedToUTC } from '@/lib/time'
import { LANES, freeLane, laneIsFree } from '@/lib/lanes'

export type ActionResult = { error?: string; ok?: string }

const DURATIONS = [30, 45, 60]

/** Winning Minds offers a time. The grid sends a date, a minute and a length. */
export async function createSlot(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireActive('admin')

  const date = String(fd.get('date') ?? '')           // YYYY-MM-DD, Prague
  const minute = Number(fd.get('minute') ?? NaN)      // minutes since midnight
  const duration = Number(fd.get('duration') ?? 45)
  const asked = Number(fd.get('lane') ?? NaN)         // which column was clicked

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(minute)) {
    return { error: 'That time could not be read.' }
  }
  if (!DURATIONS.includes(duration)) return { error: 'Pick 30, 45 or 60 minutes.' }

  const [y, m, d] = date.split('-').map(Number)
  const startsAt = zonedToUTC(y, m, d, Math.floor(minute / 60), minute % 60, TZ_CZ)

  const supabase = await createClient()

  // Two of you, so a day is two columns. The column that was clicked is
  // the lane; which of you ends up taking it is your business, not the
  // app's. Older callers send no column, so fall back to either.
  const lane = Number.isInteger(asked) && asked >= 1 && asked <= LANES
    ? ((await laneIsFree(supabase, startsAt, duration, asked)) ? asked : null)
    : await freeLane(supabase, startsAt, duration)

  if (lane === null) {
    return { error: 'That column is already busy then. Try the other one.' }
  }

  const { error } = await supabase
    .from('slots')
    .insert({ starts_at: startsAt, duration_min: duration, lane })

  if (error) {
    // 23P01 is the exclusion constraint: that lane is already busy.
    if (error.code === '23P01') return { error: 'That overlaps a time you already offer.' }
    return { error: error.message }
  }

  revalidatePath('/admin/schedule')
  return {}
}

export async function deleteSlot(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireActive('admin')
  const id = String(fd.get('id') ?? '')
  if (!id) return { error: 'Missing slot.' }

  const supabase = await createClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id')
    .eq('slot_id', id)
    .maybeSingle()

  if (booking) return { error: 'Someone has booked this time. Release the booking first.' }

  const { error } = await supabase.from('slots').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/schedule')
  return {}
}

export async function setMeetUrl(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireActive('admin')

  const url = String(fd.get('meet_url') ?? '').trim()
  const ids = String(fd.get('ids') ?? '').split(',').filter(Boolean)
  if (!url) return { error: 'Paste a Google Meet link first.' }
  if (!/^https?:\/\//i.test(url)) return { error: 'That does not look like a link.' }
  if (ids.length === 0) return { error: 'No times to apply it to.' }

  const supabase = await createClient()
  const { error } = await supabase.from('slots').update({ meet_url: url }).in('id', ids)
  if (error) return { error: error.message }

  revalidatePath('/admin/schedule')
  return { ok: `Link set on ${ids.length} time${ids.length === 1 ? '' : 's'}.` }
}

/** Winning Minds frees a booked time up again. */
export async function releaseBooking(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireActive('admin')
  const id = String(fd.get('booking_id') ?? '')
  if (!id) return { error: 'Missing booking.' }

  const supabase = await createClient()
  const { error } = await supabase.from('bookings').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/schedule')
  return {}
}

/**
 * After a call, Winning Minds records whether she turned up. Everything
 * the statistics say rests on this, so it stays deliberately simple:
 * came, did not come, or not marked yet.
 */
export async function setAttendance(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireActive('admin')
  const id = String(fd.get('booking_id') ?? '')
  const value = String(fd.get('attended') ?? '')
  if (!id) return { error: 'Missing booking.' }

  const attended = value === 'clear' ? null : value === 'true'

  const supabase = await createClient()
  const { error } = await supabase.from('bookings').update({ attended }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/schedule')
  revalidatePath('/admin/stats')
  revalidatePath('/coach')
  return {}
}

// ------------------------------------------------------------- the player

/** One call per player per week: taking a new time gives up the old one. */
export async function bookSlot(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireActive('player')
  const slotId = String(fd.get('slot_id') ?? '')
  if (!slotId) return { error: 'Missing time.' }

  const supabase = await createClient()

  const { data: slot } = await supabase
    .from('slots')
    .select('id, starts_at, duration_min, meet_url')
    .eq('id', slotId)
    .single()

  if (!slot) return { error: 'That time is no longer there.' }
  if (new Date(slot.starts_at).getTime() <= Date.now()) {
    return { error: 'That time has already passed.' }
  }

  // Drop any booking this player holds in the same Prague week.
  const mon = mondayOf(ymd(slot.starts_at, TZ_CZ))
  const from = new Date(dayStart(mon, TZ_CZ)).toISOString()
  const to = new Date(dayStart(addDays(mon, 7), TZ_CZ)).toISOString()

  const { data: mine } = await supabase
    .from('bookings')
    .select('id, slots!inner(starts_at)')
    .eq('player_id', me.id)
    .gte('slots.starts_at', from)
    .lt('slots.starts_at', to)

  for (const b of mine ?? []) {
    await supabase.from('bookings').delete().eq('id', b.id)
  }

  const { error } = await supabase
    .from('bookings')
    .insert({ slot_id: slotId, player_id: me.id })

  if (error) {
    // 23505 is the unique index on slot_id: somebody got there first.
    if (error.code === '23505') return { error: 'A teammate just took that time. Pick another.' }
    return { error: error.message }
  }

  const mail = bookingConfirmation(me.first_name, slot.starts_at, slot.duration_min, slot.meet_url)
  const sent = await sendEmail({ to: me.email, subject: mail.subject, html: mail.html })
  if (sent) {
    await supabase
      .from('bookings')
      .update({ confirmation_sent_at: new Date().toISOString() })
      .eq('slot_id', slotId)
  }

  revalidatePath('/player')
  return { ok: 'Booked.' }
}

export async function cancelBooking(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireActive('player')
  const id = String(fd.get('booking_id') ?? '')
  if (!id) return { error: 'Missing booking.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('bookings')
    .delete()
    .eq('id', id)
    .eq('player_id', me.id)

  if (error) return { error: error.message }

  revalidatePath('/player')
  return {}
}
