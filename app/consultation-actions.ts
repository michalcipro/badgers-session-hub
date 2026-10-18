'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireActive } from '@/lib/auth'
import { TZ_US, zonedToUTC } from '@/lib/time'

export type ConsultationResult = { error?: string; ok?: string }

const DURATIONS = [30, 45, 60]

/**
 * A coach asks for a time. She types it in her own Madison time, which is
 * the only clock she thinks in; everything downstream stores the instant.
 * Nothing is agreed until Winning Minds answers.
 */
export async function requestConsultation(
  _p: ConsultationResult,
  fd: FormData
): Promise<ConsultationResult> {
  const me = await requireActive('coach')

  const date = String(fd.get('date') ?? '')
  const time = String(fd.get('time') ?? '')
  const duration = Number(fd.get('duration') ?? 45)
  const topic = String(fd.get('topic') ?? '').trim()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return { error: 'Pick a date and a time.' }
  }
  if (!DURATIONS.includes(duration)) return { error: 'Pick 30, 45 or 60 minutes.' }
  if (topic.length > 500) return { error: 'Keep the note shorter.' }

  const [y, m, d] = date.split('-').map(Number)
  const [hh, mi] = time.split(':').map(Number)
  const requestedAt = zonedToUTC(y, m, d, hh, mi, TZ_US)

  if (new Date(requestedAt).getTime() <= Date.now()) {
    return { error: 'That time has already passed.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('consultations').insert({
    coach_id: me.id,
    requested_at: requestedAt,
    duration_min: duration,
    topic: topic || null,
  })

  if (error) return { error: error.message }

  revalidatePath('/coach/consultations')
  revalidatePath('/admin')
  return { ok: 'Asked. Winning Minds will confirm or suggest another time.' }
}

export async function cancelConsultation(
  _p: ConsultationResult,
  fd: FormData
): Promise<ConsultationResult> {
  const me = await requireActive()
  const id = String(fd.get('id') ?? '')
  if (!id) return { error: 'Missing request.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('consultations')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('coach_id', me.id)

  if (error) return { error: error.message }

  revalidatePath('/coach/consultations')
  revalidatePath('/admin')
  return {}
}

// ------------------------------------------------------- Winning Minds

/**
 * Confirming puts a real slot in the calendar, so the time is occupied
 * like any other call. If it would run into something already there, the
 * database says so and nothing is confirmed.
 */
export async function confirmConsultation(
  _p: ConsultationResult,
  fd: FormData
): Promise<ConsultationResult> {
  const me = await requireActive('admin')
  const id = String(fd.get('id') ?? '')
  const note = String(fd.get('note') ?? '').trim()
  if (!id) return { error: 'Missing request.' }

  const supabase = await createClient()
  const { data: request } = await supabase
    .from('consultations')
    .select('id, requested_at, duration_min, status, slot_id')
    .eq('id', id)
    .maybeSingle()

  if (!request) return { error: 'That request is gone.' }
  if (request.status !== 'requested') return { error: 'That request has already been answered.' }

  const { data: slot, error: slotError } = await supabase
    .from('slots')
    .insert({
      starts_at: request.requested_at,
      duration_min: request.duration_min,
      kind: 'consultation',
      created_by: me.id,
    })
    .select('id')
    .single()

  if (slotError) {
    if (slotError.code === '23P01') {
      return { error: 'That runs into a time you already have. Decline it and suggest another.' }
    }
    return { error: slotError.message }
  }

  const { error } = await supabase
    .from('consultations')
    .update({
      status: 'confirmed',
      slot_id: slot.id,
      decided_by: me.id,
      decided_at: new Date().toISOString(),
      note: note || null,
    })
    .eq('id', id)

  if (error) {
    await supabase.from('slots').delete().eq('id', slot.id)
    return { error: error.message }
  }

  revalidatePath('/admin')
  revalidatePath('/admin/schedule')
  revalidatePath('/coach/consultations')
  return { ok: 'Confirmed.' }
}

export async function declineConsultation(
  _p: ConsultationResult,
  fd: FormData
): Promise<ConsultationResult> {
  const me = await requireActive('admin')
  const id = String(fd.get('id') ?? '')
  const note = String(fd.get('note') ?? '').trim()
  if (!id) return { error: 'Missing request.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('consultations')
    .update({
      status: 'declined',
      decided_by: me.id,
      decided_at: new Date().toISOString(),
      note: note || null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin')
  revalidatePath('/coach/consultations')
  return {}
}
