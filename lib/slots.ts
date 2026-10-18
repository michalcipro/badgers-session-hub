import type { SupabaseClient } from '@supabase/supabase-js'
import { fullName, shortName } from './auth'
import type { SlotRow } from './week'

type Booking = { id: string; player_id: string; attended: boolean | null }

type RawSlot = {
  id: string
  starts_at: string
  duration_min: number
  meet_url: string | null
  kind: 'player' | 'consultation'
  /**
   * bookings.slot_id is unique, so PostgREST treats this as a to-one
   * relationship and sends an object rather than an array. Older versions
   * send an array, so accept both.
   */
  bookings: Booking | Booking[] | null
}

type RosterRow = { id: string; first_name: string; last_name: string }

const one = (b: Booking | Booking[] | null | undefined): Booking | null =>
  Array.isArray(b) ? (b[0] ?? null) : (b ?? null)

/**
 * Slots for one week, with the booking attached and the name rendered the
 * way this viewer is allowed to see it: Winning Minds gets full names,
 * a player sees a teammate as "Sofia M." and nothing else.
 *
 * A confirmed consultation holds a slot of its own so it occupies the
 * calendar, but it belongs to coaching staff — players never see one.
 */
export async function loadWeekSlots(
  supabase: SupabaseClient,
  fromISO: string,
  toISO: string,
  viewer: 'staff' | 'player',
  meId: string
): Promise<SlotRow[]> {
  const [{ data: slots }, { data: roster }] = await Promise.all([
    supabase
      .from('slots')
      .select('id, starts_at, duration_min, meet_url, kind, bookings(id, player_id, attended)')
      .gte('starts_at', fromISO)
      .lt('starts_at', toISO)
      .order('starts_at'),
    supabase.from('roster').select('id, first_name, last_name'),
  ])

  const names = new Map<string, RosterRow>()
  for (const p of (roster ?? []) as RosterRow[]) names.set(p.id, p)

  const visible = ((slots ?? []) as RawSlot[]).filter(
    (s) => viewer === 'staff' || s.kind === 'player'
  )

  // A consultation has no booking row, so whose it is comes from elsewhere.
  const consultBy = new Map<string, string>()
  const consultIds = visible.filter((s) => s.kind === 'consultation').map((s) => s.id)
  if (consultIds.length > 0) {
    const { data } = await supabase
      .from('consultations')
      .select('slot_id, coach_id')
      .in('slot_id', consultIds)
    for (const c of (data ?? []) as { slot_id: string; coach_id: string }[]) {
      consultBy.set(c.slot_id, c.coach_id)
    }
  }

  return visible.map((s) => {
    const booking = one(s.bookings)
    const coachId = s.kind === 'consultation' ? consultBy.get(s.id) ?? null : null
    const person = booking
      ? names.get(booking.player_id)
      : coachId
        ? names.get(coachId)
        : undefined

    let booked_name: string | null = null
    if (s.kind === 'consultation') {
      booked_name = person ? `${fullName(person)} · consultation` : 'Consultation'
    } else if (booking) {
      if (!person) booked_name = 'Booked'
      else if (viewer === 'staff') booked_name = fullName(person)
      else booked_name = booking.player_id === meId ? 'Your call' : shortName(person)
    }

    return {
      id: s.id,
      starts_at: s.starts_at,
      duration_min: s.duration_min,
      meet_url: s.meet_url,
      kind: s.kind,
      booking_id: booking?.id ?? null,
      booked_by: booking?.player_id ?? coachId,
      attended: booking?.attended ?? null,
      booked_name,
    }
  })
}
