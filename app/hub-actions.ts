'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { currentProfile, requireActive } from '@/lib/auth'

export type ActionResult = { error?: string; ok?: string }

const BUCKET = 'session-files'

// ----------------------------------------------------------------- messages

/**
 * A thread belongs to one person and Winning Minds. A player writes in her
 * own thread; Winning Minds writes in anyone's. Row-level security enforces
 * both — the check here only produces a readable message.
 */
export async function sendMessage(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireActive()
  const subjectId = String(fd.get('subject_id') ?? '')
  const body = String(fd.get('body') ?? '').trim()

  if (!body) return {}
  if (body.length > 4000) return { error: 'That message is too long.' }
  if (me.role !== 'admin' && subjectId !== me.id) {
    return { error: 'You can only write in your own conversation.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('messages')
    .insert({ subject_id: subjectId, sender_id: me.id, body })

  if (error) return { error: error.message }

  revalidatePath('/admin/messages')
  revalidatePath(`/admin/players/${subjectId}`)
  revalidatePath('/messages')
  return {}
}

// -------------------------------------------------------------------- notes

export async function addNote(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireActive('admin')
  const playerId = String(fd.get('player_id') ?? '')
  const body = String(fd.get('body') ?? '').trim()
  if (!body) return {}

  const supabase = await createClient()
  const { error } = await supabase
    .from('notes')
    .insert({ player_id: playerId, author_id: me.id, body })

  if (error) return { error: error.message }

  revalidatePath(`/admin/players/${playerId}`)
  return {}
}

export async function deleteNote(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireActive('admin')
  const id = String(fd.get('id') ?? '')
  const playerId = String(fd.get('player_id') ?? '')

  const supabase = await createClient()
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath(`/admin/players/${playerId}`)
  return {}
}

// -------------------------------------------------------------------- tasks

export async function assignTask(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireActive('admin')
  const playerId = String(fd.get('player_id') ?? '')
  const title = String(fd.get('title') ?? '').trim()
  const due = String(fd.get('due_on') ?? '')
  if (!title) return {}

  const supabase = await createClient()
  const { error } = await supabase.from('tasks').insert({
    player_id: playerId,
    title,
    due_on: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null,
    assigned_by: me.id,
  })

  if (error) return { error: error.message }

  revalidatePath(`/admin/players/${playerId}`)
  revalidatePath('/tasks')
  return {}
}

/** A player ticks her own task; Winning Minds can tick anyone's. */
export async function toggleTask(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireActive()
  const id = String(fd.get('id') ?? '')
  const done = String(fd.get('done') ?? '') === 'true'

  const supabase = await createClient()
  const { error } = await supabase
    .from('tasks')
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/tasks')
  revalidatePath('/admin/players', 'layout')
  return {}
}

export async function deleteTask(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireActive('admin')
  const id = String(fd.get('id') ?? '')
  const playerId = String(fd.get('player_id') ?? '')

  const supabase = await createClient()
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath(`/admin/players/${playerId}`)
  return {}
}

// -------------------------------------------------------------------- files

const MAX_BYTES = 25 * 1024 * 1024

export async function uploadFile(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireActive('admin')
  const file = fd.get('file')
  const visibleTo = String(fd.get('visible_to') ?? '')

  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a file first.' }
  if (file.size > MAX_BYTES) return { error: 'That file is larger than 25 MB.' }

  const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(-80)
  const path = `${randomUUID()}-${safe}`

  const storage = createAdminClient()
  const { error: upErr } = await storage.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || 'application/octet-stream' })

  if (upErr) return { error: `Upload failed: ${upErr.message}` }

  const supabase = await createClient()
  const { error } = await supabase.from('files').insert({
    storage_path: path,
    name: file.name,
    size_bytes: file.size,
    visible_to: visibleTo === 'all' ? null : visibleTo,
    uploaded_by: me.id,
  })

  if (error) {
    await storage.storage.from(BUCKET).remove([path])
    return { error: error.message }
  }

  revalidatePath('/admin/files')
  if (visibleTo !== 'all') revalidatePath(`/admin/players/${visibleTo}`)
  revalidatePath('/files')
  return { ok: `${file.name} uploaded.` }
}

export async function deleteFile(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireActive('admin')
  const id = String(fd.get('id') ?? '')

  const supabase = await createClient()
  const { data: row } = await supabase.from('files').select('storage_path').eq('id', id).single()
  if (!row) return { error: 'That file is already gone.' }

  const { error } = await supabase.from('files').delete().eq('id', id)
  if (error) return { error: error.message }

  await createAdminClient().storage.from(BUCKET).remove([row.storage_path])

  revalidatePath('/admin/files')
  revalidatePath('/files')
  return {}
}

/**
 * Reads the row with the caller's own client, so the database decides
 * whether they may have it, then signs a short-lived URL.
 * Returns null when they may not.
 */
export async function signedFileUrl(id: string): Promise<string | null> {
  const me = await currentProfile()
  if (!me || me.status !== 'active') return null

  const supabase = await createClient()
  const { data: row } = await supabase
    .from('files')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle()

  if (!row) return null

  const { data } = await createAdminClient()
    .storage.from(BUCKET)
    .createSignedUrl(row.storage_path, 60)

  return data?.signedUrl ?? null
}
