import { LANES } from './lanes'
import { TZ_CZ, addDays, dayKey, minutesInDay, ymd, zonedToUTC, type CalDate } from './time'

export type Timed = { starts_at: string; duration_min: number }
export type Placed = Timed & { lane: number }
export type NewSlot = Placed

/** How far ahead a schedule may be rolled out in one go. */
export const MAX_WEEKS = 52

/** Whole days since the epoch — exact, unlike dividing milliseconds. */
const dayNum = (o: CalDate) => Math.round(Date.UTC(o.y, o.m - 1, o.d) / 86_400_000)

export const weeksBetween = (from: CalDate, to: CalDate) =>
  Math.floor((dayNum(to) - dayNum(from)) / 7)

/**
 * Rolls one week forward, week after week, in Prague wall-clock terms: a
 * call at 15:00 stays at 15:00 once the clocks change, which is the only
 * thing either of us thinks in. Madison follows along on its own.
 *
 * Anything that would run into a time already in the calendar is left
 * out rather than forced in, and counted so you can see it happened.
 */
export function planRepeat(
  template: Timed[],
  existing: Placed[],
  firstDay: CalDate,
  lastDay: CalDate
): { rows: NewSlot[]; skipped: number } {
  const busy = existing.map((s) => ({
    from: +new Date(s.starts_at),
    to: +new Date(s.starts_at) + s.duration_min * 60_000,
    lane: s.lane,
  }))

  const rows: NewSlot[] = []
  const until = dayKey(lastDay)
  let skipped = 0

  const weeks = Math.min(weeksBetween(firstDay, lastDay), MAX_WEEKS)

  for (let w = 1; w <= weeks; w++) {
    for (const t of template) {
      const day = addDays(ymd(t.starts_at, TZ_CZ), w * 7)
      if (dayKey(day) > until) continue

      const min = minutesInDay(t.starts_at, TZ_CZ)
      const starts_at = zonedToUTC(day.y, day.m, day.d, Math.floor(min / 60), min % 60, TZ_CZ)
      const from = +new Date(starts_at)
      const to = from + t.duration_min * 60_000

      const taken = new Set(
        busy.filter((b) => b.from < to && from < b.to).map((b) => b.lane)
      )
      let lane = 0
      for (let l = 1; l <= LANES; l++) if (!taken.has(l)) { lane = l; break }
      if (!lane) { skipped++; continue }

      busy.push({ from, to, lane })
      rows.push({ starts_at, duration_min: t.duration_min, lane })
    }
  }

  return { rows, skipped }
}
