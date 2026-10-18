import type { SupabaseClient } from '@supabase/supabase-js'
import {
  addDays, dayStart, minutesInDay, mondayOf, ymd,
  type CalDate,
} from './time'

export type SlotRow = {
  id: string
  starts_at: string
  duration_min: number
  meet_url: string | null
  kind: 'player' | 'consultation'
  /** Which of the two of us runs it. A position, not a person. */
  lane: number
  booking_id: string | null
  booked_by: string | null
  attended: boolean | null
  /** How this viewer is allowed to see the name: full, or first name + initial. */
  booked_name: string | null
}

const KEY = /^\d{4}-\d{2}-\d{2}$/

/** Monday of the week in `?week=`, or of today in the viewer's own zone. */
export function weekStartFor(param: string | undefined, tz: string): CalDate {
  if (param && KEY.test(param)) {
    const [y, m, d] = param.split('-').map(Number)
    return mondayOf({ y, m, d })
  }
  return mondayOf(ymd(new Date().toISOString(), tz))
}

export function weekRange(mon: CalDate, tz: string) {
  return {
    fromISO: new Date(dayStart(mon, tz)).toISOString(),
    toISO: new Date(dayStart(addDays(mon, 7), tz)).toISOString(),
  }
}

/**
 * Which hours the grid has to show. Starts from a sensible default and
 * widens to fit whatever is actually booked, so the Madison grid follows
 * the Prague times through a daylight-saving change on its own.
 */
export function hourRange(
  slots: SlotRow[],
  tz: string,
  [defStart, defEnd]: [number, number]
): [number, number] {
  let start = defStart
  let end = defEnd
  for (const s of slots) {
    const from = minutesInDay(s.starts_at, tz)
    const to = from + s.duration_min
    start = Math.min(start, Math.floor(from / 60))
    end = Math.max(end, Math.ceil(to / 60))
  }
  return [Math.max(0, start), Math.min(24, end)]
}

/**
 * The week to open on when nobody asked for one: this one if it still
 * holds a time, otherwise the first one ahead that does.
 *
 * Landing on an empty grid is a bad first impression and a worse
 * instruction — it looks like there is nothing rather than like there is
 * something one tap to the right.
 */
export async function openingWeek(supabase: SupabaseClient, tz: string): Promise<CalDate> {
  const now = new Date().toISOString()
  const thisWeek = mondayOf(ymd(now, tz))

  const { data } = await supabase
    .from('slots')
    .select('starts_at')
    .eq('kind', 'player')
    .gt('starts_at', now)
    .order('starts_at')
    .limit(1)

  const first = (data ?? [])[0]?.starts_at as string | undefined
  if (!first) return thisWeek

  const week = mondayOf(ymd(first, tz))
  return dayStart(week, tz) > dayStart(thisWeek, tz) ? week : thisWeek
}
