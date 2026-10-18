import type { SupabaseClient } from '@supabase/supabase-js'

/** How many calls Winning Minds can run side by side — Michal and Milan. */
export const LANES = 2

/** The lanes busy over a stretch of time — one query, used by both callers. */
async function takenLanes(
  supabase: SupabaseClient,
  startsAt: string,
  durationMin: number
): Promise<Set<number>> {
  const start = new Date(startsAt).getTime()
  const end = start + durationMin * 60_000
  const window = 3 * 60 * 60_000 // the longest slot is an hour, so this is ample

  const { data } = await supabase
    .from('slots')
    .select('starts_at, duration_min, lane')
    .gte('starts_at', new Date(start - window).toISOString())
    .lte('starts_at', new Date(start + window).toISOString())

  const taken = new Set<number>()
  for (const s of (data ?? []) as { starts_at: string; duration_min: number; lane: number }[]) {
    const sStart = new Date(s.starts_at).getTime()
    const sEnd = sStart + s.duration_min * 60_000
    if (sStart < end && start < sEnd) taken.add(s.lane)
  }
  return taken
}

/** Whether one particular lane is open — the column somebody clicked. */
export async function laneIsFree(
  supabase: SupabaseClient,
  startsAt: string,
  durationMin: number,
  lane: number
): Promise<boolean> {
  return !(await takenLanes(supabase, startsAt, durationMin)).has(lane)
}

/**
 * Which lane is free at a given time, or null when they all are taken.
 *
 * A lane is a position, not a person: the two of them sort out between
 * themselves who takes which call, and nothing here needs to know.
 */
export async function freeLane(
  supabase: SupabaseClient,
  startsAt: string,
  durationMin: number
): Promise<number | null> {
  const taken = await takenLanes(supabase, startsAt, durationMin)
  for (let lane = 1; lane <= LANES; lane++) if (!taken.has(lane)) return lane
  return null
}
