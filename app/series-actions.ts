'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireActive } from '@/lib/auth'
import { TZ_CZ, addDays, dayKey, dayStart, mondayOf, ymd, type CalDate } from '@/lib/time'
import { MAX_WEEKS, planRepeat, weeksBetween } from '@/lib/repeat'

export type SeriesResult = { error?: string; ok?: string }

const KEY = /^\d{4}-\d{2}-\d{2}$/
const asDate = (s: string): CalDate => {
  const [y, m, d] = s.split('-').map(Number)
  return { y, m, d }
}

/** Bookings come back as an object, not an array: slot_id is unique. */
const booked = (b: unknown): boolean => (Array.isArray(b) ? b.length > 0 : b != null)

/**
 * Takes the week on screen as the pattern and rolls it forward until a
 * date you choose. That date is where the availability ends; there is
 * no open-ended schedule, so nothing keeps generating behind your back.
 */
export async function repeatWeek(_p: SeriesResult, fd: FormData): Promise<SeriesResult> {
  const me = await requireActive('admin')

  const week = String(fd.get('week') ?? '')
  const until = String(fd.get('until') ?? '')
  if (!KEY.test(week) || !KEY.test(until)) {
    return { error: 'Pick the date the availability should run until.' }
  }

  const mon = mondayOf(asDate(week))
  const last = asDate(until)

  const weeks = weeksBetween(mon, last)
  if (weeks < 1) return { error: 'Pick a date at least a week after this one.' }
  if (weeks > MAX_WEEKS) return { error: 'A year ahead is as far as this goes.' }

  const supabase = await createClient()

  const from = new Date(dayStart(mon, TZ_CZ)).toISOString()
  const nextWeek = new Date(dayStart(addDays(mon, 7), TZ_CZ)).toISOString()
  const to = new Date(dayStart(addDays(last, 1), TZ_CZ)).toISOString()

  const { data: template, error: templateError } = await supabase
    .from('slots')
    .select('starts_at, duration_min')
    .eq('kind', 'player')
    .gte('starts_at', from)
    .lt('starts_at', nextWeek)
    .order('starts_at')

  if (templateError) return { error: templateError.message }
  if (!template || template.length === 0) {
    return { error: 'Offer some times in this week first — that is the pattern.' }
  }

  const { data: existing, error: existingError } = await supabase
    .from('slots')
    .select('starts_at, duration_min, lane')
    .gte('starts_at', nextWeek)
    .lt('starts_at', to)

  if (existingError) return { error: existingError.message }

  const { rows, skipped } = planRepeat(template, existing ?? [], mon, last)
  if (rows.length === 0) {
    return { error: 'Every one of those times is already in the calendar.' }
  }

  const { data: series, error: seriesError } = await supabase
    .from('slot_series')
    .insert({ created_by: me.id, source_week: dayKey(mon), ends_on: dayKey(last) })
    .select('id')
    .single()

  if (seriesError) return { error: seriesError.message }

  // Chunked, because a year of a busy week is a few hundred rows.
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase
      .from('slots')
      .insert(rows.slice(i, i + 200).map((r) => ({ ...r, series_id: series.id, kind: 'player' })))

    if (error) {
      await supabase.from('slots').delete().eq('series_id', series.id)
      await supabase.from('slot_series').delete().eq('id', series.id)
      return { error: error.message }
    }
  }

  revalidatePath('/admin/schedule')
  return {
    ok:
      `${rows.length} more time${rows.length === 1 ? '' : 's'} added, through ${until}.` +
      (skipped > 0 ? ` ${skipped} skipped — already taken by something else.` : ''),
  }
}

/**
 * Ends a schedule early. Times somebody has already booked are left
 * alone: she has them in her calendar, so they are yours to cancel one
 * by one if you really mean it.
 */
export async function endSeries(_p: SeriesResult, fd: FormData): Promise<SeriesResult> {
  await requireActive('admin')
  const id = String(fd.get('id') ?? '')
  if (!id) return { error: 'Missing schedule.' }

  const supabase = await createClient()
  const { data: slots, error } = await supabase
    .from('slots')
    .select('id, bookings(id)')
    .eq('series_id', id)
    .gte('starts_at', new Date().toISOString())

  if (error) return { error: error.message }

  const free = (slots ?? []).filter((s) => !booked(s.bookings)).map((s) => s.id)
  const kept = (slots ?? []).length - free.length

  if (free.length > 0) {
    const { error: delError } = await supabase.from('slots').delete().in('id', free)
    if (delError) return { error: delError.message }
  }

  // Today in Prague, never earlier than the week it started: a schedule
  // stopped the same week it began still ends on its own first day.
  const today = dayKey(ymd(new Date().toISOString(), TZ_CZ))
  const { data: row } = await supabase
    .from('slot_series')
    .select('source_week')
    .eq('id', id)
    .maybeSingle()

  const endsOn = row && today < row.source_week ? row.source_week : today
  const { error: endError } = await supabase
    .from('slot_series')
    .update({ ends_on: endsOn })
    .eq('id', id)

  if (endError) return { error: endError.message }

  revalidatePath('/admin/schedule')
  return {
    ok:
      `Stopped. ${free.length} upcoming time${free.length === 1 ? '' : 's'} removed` +
      (kept > 0 ? `, ${kept} left in place because they are booked.` : '.'),
  }
}

/** A holiday: everything open that day goes, whatever schedule put it there. */
export async function clearDay(_p: SeriesResult, fd: FormData): Promise<SeriesResult> {
  await requireActive('admin')
  const day = String(fd.get('day') ?? '')
  if (!KEY.test(day)) return { error: 'Pick a date.' }

  const d = asDate(day)
  const supabase = await createClient()

  const { data: slots, error } = await supabase
    .from('slots')
    .select('id, bookings(id)')
    .eq('kind', 'player')
    .gte('starts_at', new Date(dayStart(d, TZ_CZ)).toISOString())
    .lt('starts_at', new Date(dayStart(addDays(d, 1), TZ_CZ)).toISOString())

  if (error) return { error: error.message }

  const free = (slots ?? []).filter((s) => !booked(s.bookings)).map((s) => s.id)
  const kept = (slots ?? []).length - free.length

  if (free.length === 0) {
    return kept > 0
      ? { error: 'Everything that day is booked. Release those first.' }
      : { error: 'Nothing was open that day anyway.' }
  }

  const { error: delError } = await supabase.from('slots').delete().in('id', free)
  if (delError) return { error: delError.message }

  revalidatePath('/admin/schedule')
  return {
    ok:
      `${free.length} time${free.length === 1 ? '' : 's'} taken off ${day}` +
      (kept > 0 ? `, ${kept} left because they are booked.` : '.'),
  }
}
