import type { SupabaseClient } from '@supabase/supabase-js'

/** The lengths a call may be. Anything else is refused. */
export const SESSION_LENGTHS = [30, 45, 60] as const
export const DEFAULT_SESSION_MIN = 30

/**
 * How long a call is, for everybody. There is no per-slot choice: the
 * grid used to offer one next to every click, which made it far too easy
 * to leave a stray 60-minute Tuesday in among the 30s.
 *
 * Falls back to the default rather than throwing, so a calendar still
 * draws if the row is somehow missing.
 */
export async function sessionMin(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase.from('settings').select('session_min').maybeSingle()
  const value = data?.session_min
  return SESSION_LENGTHS.includes(value) ? value : DEFAULT_SESSION_MIN
}
