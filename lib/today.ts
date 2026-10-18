import type { SupabaseClient } from '@supabase/supabase-js'
import { fullName, type Profile } from './auth'

export type UpcomingCall = {
  id: string
  starts_at: string
  duration_min: number
  meet_url: string | null
  kind: 'player' | 'consultation'
  who: string
  bookingId: string | null
}

export type Today = {
  calls: UpcomingCall[]
  /** Players with nothing booked ahead of them. */
  idle: { id: string; name: string }[]
  /** Threads where the last word was theirs. */
  waiting: { id: string; name: string; at: string }[]
}

const DAYS_AHEAD = 14

/**
 * What a day of this actually looks like: the calls that are going to
 * happen, who has not booked one, and who is waiting on an answer.
 *
 * The page used to be an approvals queue, which is empty almost always
 * now that Winning Minds makes the accounts, plus a second copy of the
 * roster. Neither is a reason to open it in the morning.
 */
export async function loadToday(supabase: SupabaseClient, me: Profile): Promise<Today> {
  const now = new Date()
  const until = new Date(now.getTime() + DAYS_AHEAD * 24 * 3600_000).toISOString()
  const nowISO = now.toISOString()

  const [{ data: people }, { data: slots }, { data: booked }, { data: lastWord }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('status', 'active'),
      supabase
        .from('slots')
        .select('id, starts_at, duration_min, meet_url, kind, bookings(id, player_id)')
        .gte('starts_at', nowISO)
        .lt('starts_at', until)
        .order('starts_at'),
      supabase
        .from('bookings')
        .select('player_id, slots!inner(starts_at)')
        .gt('slots.starts_at', nowISO),
      supabase
        .from('messages')
        .select('subject_id, sender_id, created_at')
        .order('created_at', { ascending: false }),
    ])

  const active = (people ?? []) as Profile[]
  const byId = new Map(active.map((p) => [p.id, p]))
  const name = (id: string | null | undefined) => {
    const p = id ? byId.get(id) : undefined
    return p ? fullName(p) : 'Someone'
  }

  // Whose consultation is whose: a consultation slot carries no booking.
  const consultIds = (slots ?? [])
    .filter((s) => s.kind === 'consultation')
    .map((s) => s.id as string)

  const coachOf = new Map<string, string>()
  if (consultIds.length > 0) {
    const { data } = await supabase
      .from('consultations')
      .select('slot_id, coach_id')
      .in('slot_id', consultIds)
    for (const c of (data ?? []) as { slot_id: string; coach_id: string }[]) {
      coachOf.set(c.slot_id, c.coach_id)
    }
  }

  type Row = {
    id: string
    starts_at: string
    duration_min: number
    meet_url: string | null
    kind: 'player' | 'consultation'
    bookings: { id: string; player_id: string } | { id: string; player_id: string }[] | null
  }

  const calls: UpcomingCall[] = []
  for (const s of (slots ?? []) as Row[]) {
    const booking = Array.isArray(s.bookings) ? s.bookings[0] : s.bookings
    if (s.kind === 'consultation') {
      calls.push({
        id: s.id,
        starts_at: s.starts_at,
        duration_min: s.duration_min,
        meet_url: s.meet_url,
        kind: 'consultation',
        who: `${name(coachOf.get(s.id))} · consultation`,
        bookingId: null,
      })
    } else if (booking) {
      calls.push({
        id: s.id,
        starts_at: s.starts_at,
        duration_min: s.duration_min,
        meet_url: s.meet_url,
        kind: 'player',
        who: name(booking.player_id),
        bookingId: booking.id,
      })
    }
  }

  const hasCall = new Set(
    ((booked ?? []) as { player_id: string }[]).map((b) => b.player_id)
  )
  const idle = active
    .filter((p) => p.role === 'player' && !hasCall.has(p.id))
    .map((p) => ({ id: p.id, name: fullName(p) }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // One row per thread, newest first, so the first one seen is the last word.
  const seen = new Set<string>()
  const waiting: Today['waiting'] = []
  for (const m of (lastWord ?? []) as { subject_id: string; sender_id: string; created_at: string }[]) {
    if (seen.has(m.subject_id)) continue
    seen.add(m.subject_id)
    const sender = byId.get(m.sender_id)
    if (!sender || sender.role === 'admin') continue
    if (m.subject_id === me.id) continue
    waiting.push({ id: m.subject_id, name: name(m.subject_id), at: m.created_at })
  }

  return { calls, idle, waiting }
}
