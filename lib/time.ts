/**
 * Prague and Madison are two renderings of one absolute instant.
 *
 * The gap is 7 hours for most of the year but 6 for a few weeks each
 * spring and autumn, because the EU and the US change clocks on different
 * dates. Nothing here hardcodes that — it is read from the time zone data.
 */

export const TZ_CZ = 'Europe/Prague'
export const TZ_US = 'America/Chicago'

export type CalDate = { y: number; m: number; d: number }

function offsetMin(date: Date, tz: string): number {
  const parts: Record<string, string> = {}
  for (const p of new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date)) parts[p.type] = p.value

  const asUTC = Date.UTC(
    +parts.year, +parts.month - 1, +parts.day,
    +parts.hour, +parts.minute, +parts.second
  )
  return Math.round((asUTC - date.getTime()) / 60000)
}

/** Wall-clock time in a zone → the instant it refers to. */
export function zonedToUTC(
  y: number, m: number, d: number, hh: number, mi: number, tz: string
): string {
  let ts = Date.UTC(y, m - 1, d, hh, mi)
  for (let i = 0; i < 2; i++) {
    ts = Date.UTC(y, m - 1, d, hh, mi) - offsetMin(new Date(ts), tz) * 60000
  }
  return new Date(ts).toISOString()
}

/** Hours between Prague and Madison at a given instant: 7, sometimes 6. */
export function gapHours(iso: string | Date): number {
  const d = new Date(iso)
  return (offsetMin(d, TZ_CZ) - offsetMin(d, TZ_US)) / 60
}

const fmt = (iso: string | Date, tz: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', { timeZone: tz, ...o }).format(new Date(iso))

/** Prague is written 24-hour, Madison 12-hour, the way each side reads it. */
export const czTime = (iso: string | Date) =>
  fmt(iso, TZ_CZ, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
export const usTime = (iso: string | Date) =>
  fmt(iso, TZ_US, { hour: 'numeric', minute: '2-digit', hour12: true })
export const czDay = (iso: string | Date) =>
  fmt(iso, TZ_CZ, { weekday: 'short', day: 'numeric', month: 'short' })
export const usDay = (iso: string | Date) =>
  fmt(iso, TZ_US, { weekday: 'short', day: 'numeric', month: 'short' })

export const timeIn = (iso: string | Date, tz: string) =>
  tz === TZ_CZ ? czTime(iso) : usTime(iso)
export const dayIn = (iso: string | Date, tz: string) =>
  tz === TZ_CZ ? czDay(iso) : usDay(iso)

// ---------------------------------------------------------- calendar maths
// Plain date arithmetic, used to lay a week out in the viewer's own zone.

export function ymd(iso: string | Date, tz: string): CalDate {
  const p: Record<string, string> = {}
  for (const x of new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(iso))) p[x.type] = x.value
  return { y: +p.year, m: +p.month, d: +p.day }
}

export function addDays(o: CalDate, n: number): CalDate {
  const t = new Date(Date.UTC(o.y, o.m - 1, o.d + n))
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}

export const mondayOf = (o: CalDate): CalDate =>
  addDays(o, -((new Date(Date.UTC(o.y, o.m - 1, o.d)).getUTCDay() + 6) % 7))

export const dayKey = (o: CalDate) =>
  `${o.y}-${String(o.m).padStart(2, '0')}-${String(o.d).padStart(2, '0')}`

export const dayStart = (o: CalDate, tz: string) =>
  +new Date(zonedToUTC(o.y, o.m, o.d, 0, 0, tz))

export const calFmt = (o: CalDate, opt: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opt })
    .format(new Date(Date.UTC(o.y, o.m - 1, o.d)))

/** Minutes since midnight in the given zone — where a slot sits in a day column. */
export function minutesInDay(iso: string | Date, tz: string): number {
  const p: Record<string, string> = {}
  for (const x of new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hourCycle: 'h23', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(iso))) p[x.type] = x.value
  return +p.hour * 60 + +p.minute
}

/** Label for an hour row, in that zone's own convention. */
export function hourLabel(hour: number, tz: string): string {
  if (tz === TZ_CZ) return `${String(hour).padStart(2, '0')}:00`
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h} ${hour < 12 ? 'am' : 'pm'}`
}

/** Minutes since midnight as a clock time, for labels on quarter-hour cells. */
export function minuteLabel(minute: number, tz: string): string {
  const h = Math.floor(minute / 60)
  const m = String(minute % 60).padStart(2, '0')
  if (tz === TZ_CZ) return `${String(h).padStart(2, '0')}:${m}`
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m} ${h < 12 ? 'am' : 'pm'}`
}
