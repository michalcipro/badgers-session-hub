import type { SupabaseClient } from '@supabase/supabase-js'

export type SeriesRow = {
  id: string
  source_week: string
  ends_on: string
  /** Times still ahead of us, so you can see what stopping would remove. */
  upcoming: number
}

/** The repeating schedules, newest first, with what is still to come. */
export async function loadSeries(supabase: SupabaseClient): Promise<SeriesRow[]> {
  const { data } = await supabase
    .from('slot_series')
    .select('id, source_week, ends_on')
    .order('created_at', { ascending: false })
    .limit(12)

  const series = (data ?? []) as Omit<SeriesRow, 'upcoming'>[]
  if (series.length === 0) return []

  const { data: ahead } = await supabase
    .from('slots')
    .select('series_id')
    .in('series_id', series.map((s) => s.id))
    .gte('starts_at', new Date().toISOString())

  const count = new Map<string, number>()
  for (const s of (ahead ?? []) as { series_id: string }[]) {
    count.set(s.series_id, (count.get(s.series_id) ?? 0) + 1)
  }

  return series.map((s) => ({ ...s, upcoming: count.get(s.id) ?? 0 }))
}
