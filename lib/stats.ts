import type { SupabaseClient } from '@supabase/supabase-js'
import { loadRoster, type RosterRow } from './hub'
import { fullName } from './auth'
import { TZ_CZ, addDays, calFmt, dayKey, mondayOf, ymd } from './time'

/**
 * Everything here is counted from two facts the app already records: who
 * booked which time, and whether Winning Minds marked them as having
 * turned up. Nothing about what was said in a session is involved, so the
 * same numbers are safe to show coaching staff.
 */

export type SessionRow = {
  slotId: string
  bookingId: string | null
  startsAt: string
  durationMin: number
  playerId: string | null
  playerName: string | null
  attended: boolean | null
  hasLink: boolean
  past: boolean
}

export type PlayerStat = {
  id: string
  name: string
  booked: number
  attended: number
  missed: number
  unmarked: number
  rate: number | null
  lastCall: string | null
  nextCall: string | null
  openTasks: number
  doneTasks: number
}

export type WeekStat = {
  key: string
  label: string
  offered: number
  booked: number
  attended: number
  missed: number
  past: boolean
}

export type Totals = {
  offered: number
  booked: number
  held: number
  attended: number
  missed: number
  unmarked: number
  fillRate: number | null
  attendanceRate: number | null
  upcoming: number
}

export type Stats = {
  sessions: SessionRow[]
  players: PlayerStat[]
  weeks: WeekStat[]
  totals: Totals
}

type Booking = { id: string; player_id: string; attended: boolean | null }
type RawSlot = {
  id: string
  starts_at: string
  duration_min: number
  meet_url: string | null
  bookings: Booking | Booking[] | null
}

const one = (b: Booking | Booking[] | null | undefined): Booking | null =>
  Array.isArray(b) ? (b[0] ?? null) : (b ?? null)

const pct = (part: number, whole: number) =>
  whole === 0 ? null : Math.round((part / whole) * 100)

export async function loadStats(supabase: SupabaseClient): Promise<Stats> {
  const [{ data: rawSlots }, { data: rawTasks }, roster] = await Promise.all([
    supabase
      .from('slots')
      .select('id, starts_at, duration_min, meet_url, bookings(id, player_id, attended)')
      .order('starts_at', { ascending: false }),
    supabase.from('tasks').select('player_id, done_at'),
    loadRoster(supabase),
  ])

  const now = Date.now()

  const sessions: SessionRow[] = ((rawSlots ?? []) as RawSlot[]).map((s) => {
    const b = one(s.bookings)
    const who = b ? roster.get(b.player_id) : undefined
    return {
      slotId: s.id,
      bookingId: b?.id ?? null,
      startsAt: s.starts_at,
      durationMin: s.duration_min,
      playerId: b?.player_id ?? null,
      playerName: who ? fullName(who) : b ? 'Unknown' : null,
      attended: b?.attended ?? null,
      hasLink: Boolean(s.meet_url),
      past: new Date(s.starts_at).getTime() < now,
    }
  })

  // ------------------------------------------------------------- per week
  const byWeek = new Map<string, WeekStat>()
  for (const s of sessions) {
    const mon = mondayOf(ymd(s.startsAt, TZ_CZ))
    const key = dayKey(mon)
    let w = byWeek.get(key)
    if (!w) {
      w = {
        key,
        label:
          `${calFmt(mon, { month: 'short', day: 'numeric' })} – ` +
          `${calFmt(addDays(mon, 6), { month: 'short', day: 'numeric' })}`,
        offered: 0, booked: 0, attended: 0, missed: 0, past: true,
      }
      byWeek.set(key, w)
    }
    w.offered++
    if (s.playerId) w.booked++
    if (s.attended === true) w.attended++
    if (s.attended === false) w.missed++
    if (!s.past) w.past = false
  }
  const weeks = [...byWeek.values()].sort((a, b) => (a.key < b.key ? 1 : -1))

  // ----------------------------------------------------------- per player
  const openTasks = new Map<string, number>()
  const doneTasks = new Map<string, number>()
  for (const t of (rawTasks ?? []) as { player_id: string; done_at: string | null }[]) {
    const map = t.done_at ? doneTasks : openTasks
    map.set(t.player_id, (map.get(t.player_id) ?? 0) + 1)
  }

  const players: PlayerStat[] = [...roster.values()]
    .filter((p: RosterRow) => p.role === 'player')
    .map((p) => {
      const mine = sessions.filter((s) => s.playerId === p.id)
      const held = mine.filter((s) => s.past)
      const attended = held.filter((s) => s.attended === true).length
      const missed = held.filter((s) => s.attended === false).length
      const marked = attended + missed
      const upcoming = mine.filter((s) => !s.past).sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1))
      const previous = held.sort((a, b) => (a.startsAt < b.startsAt ? 1 : -1))

      return {
        id: p.id,
        name: fullName(p),
        booked: mine.length,
        attended,
        missed,
        unmarked: held.length - marked,
        rate: pct(attended, marked),
        lastCall: previous[0]?.startsAt ?? null,
        nextCall: upcoming[0]?.startsAt ?? null,
        openTasks: openTasks.get(p.id) ?? 0,
        doneTasks: doneTasks.get(p.id) ?? 0,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  // --------------------------------------------------------------- totals
  const past = sessions.filter((s) => s.past)
  const heldSessions = past.filter((s) => s.playerId)
  const attended = heldSessions.filter((s) => s.attended === true).length
  const missed = heldSessions.filter((s) => s.attended === false).length

  const totals: Totals = {
    offered: sessions.length,
    booked: sessions.filter((s) => s.playerId).length,
    held: heldSessions.length,
    attended,
    missed,
    unmarked: heldSessions.length - attended - missed,
    fillRate: pct(sessions.filter((s) => s.playerId).length, sessions.length),
    attendanceRate: pct(attended, attended + missed),
    upcoming: sessions.filter((s) => !s.past && s.playerId).length,
  }

  return { sessions, players, weeks, totals }
}
