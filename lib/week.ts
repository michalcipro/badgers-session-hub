import {
  addDays, dayStart, minutesInDay, mondayOf, ymd,
  type CalDate,
} from './time'

export type SlotRow = {
  id: string
  starts_at: string
  duration_min: number
  meet_url: string | null
  booking_id: string | null
  booked_by: string | null
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
