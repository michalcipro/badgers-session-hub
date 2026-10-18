import type { SupabaseClient } from '@supabase/supabase-js'
import { fullName, shortName } from './auth'
import type { SlotRow } from './week'

type RawSlot = {
  id: string
  starts_at: string
  duration_min: number
  meet_url: string | null
  bookings: { id: string; player_id: string }[] | null
}

type RosterRow = { id: string; first_name: string; last_name: string }

/**
 * Slots for one week, with the booking attached and the name rendered the
 * way this viewer is allowed to see it: Winning Minds gets full names,
 * a player sees a teammate as "Sofia M." and nothing else.
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
      .select('id, starts_at, duration_min, meet_url, bookings(id, player_id)')
      .gte('starts_at', fromISO)
      .lt('starts_at', toISO)
      .order('starts_at'),
    supabase.from('roster').select('id, first_name, last_name'),
  ])

  const names = new Map<string, RosterRow>()
  for (const p of (roster ?? []) as RosterRow[]) names.set(p.id, p)

  return ((slots ?? []) as RawSlot[]).map((s) => {
    const booking = s.bookings?.[0] ?? null
    const person = booking ? names.get(booking.player_id) : undefined

    let booked_name: string | null = null
    if (booking) {
      if (!person) booked_name = 'Booked'
      else if (viewer === 'staff') booked_name = fullName(person)
      else booked_name = booking.player_id === meId ? 'Your call' : shortName(person)
    }

    return {
      id: s.id,
      starts_at: s.starts_at,
      duration_min: s.duration_min,
      meet_url: s.meet_url,
      booking_id: booking?.id ?? null,
      booked_by: booking?.player_id ?? null,
      booked_name,
    }
  })
}
