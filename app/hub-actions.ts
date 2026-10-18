'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { currentProfile, requireActive } from '@/lib/auth'

export type ActionResult = { error?: string; ok?: string }

const BUCKET = 'session-files'
const MAX_BYTES = 25 * 1024 * 1024

// ----------------------------------------------------------------- messages

type Attachment = { file_path: string; file_name: string; file_size: number }

/**
 * Puts a message's attachment in storage and hands back what to record on
 * the message. One object however many people it goes to — the copies are
 * rows, not bytes.
 *
 * Returns null when there is no file, or a readable complaint when there
 * is one and it will not do.
 */
async function stashAttachment(
  value: FormDataEntryValue | null
): Promise<{ at: Attachment | null } | { error: string }> {
  if (!(value instanceof File) || value.size === 0) return { at: null }
  if (value.size > MAX_BYTES) return { error: 'That file is larger than 25 MB.' }

  const safe = value.name.replace(/[^\w.\-]+/g, '_').slice(-80)
  const path = `${randomUUID()}-${safe}`

  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .upload(path, value, { contentType: value.type || 'application/octet-stream' })

  if (error) return { error: `Upload failed: ${error.message}` }
  return { at: { file_path: path, file_name: value.name, file_size: value.size } }
}

/** Takes an attachment back out again when the row it belonged to never landed. */
const unstash = (at: Attachment | null) =>
  at ? createAdminClient().storage.from(BUCKET).remove([at.file_path]) : Promise.resolve()

/**
 * A thread belongs to one person and Winning Minds. A player writes in her
 * own thread; Winning Minds writes in anyone's. Row-level security enforces
 * both — the check here only produces a readable message.
 */
export async function sendMessage(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireActive()
  const subjectId = String(fd.get('subject_id') ?? '')
  const body = String(fd.get('body') ?? '').trim()

  if (body.length > 4000) return { error: 'That message is too long.' }
  if (me.role !== 'admin' && subjectId !== me.id) {
    return { error: 'You can only write in your own conversation.' }
  }

  const stashed = await stashAttachment(fd.get('file'))
  if ('error' in stashed) return { error: stashed.error }
  if (!body && !stashed.at) return {}

  const supabase = await createClient()
  const { error } = await supabase
    .from('messages')
    .insert({ subject_id: subjectId, sender_id: me.id, body, ...(stashed.at ?? {}) })

  if (error) {
    await unstash(stashed.at)
    return { error: error.message }
  }

  revalidatePath('/admin/messages')
  revalidatePath(`/admin/players/${subjectId}`)
  revalidatePath('/messages')
  return {}
}

/**
 * The same message to several people at once — the start of a week, a
 * change of plan, a file worth reading.
 *
 * It is not a group chat: each person gets it in her own thread, so a
 * reply comes back privately and nobody learns who else was written to.
 * That is the same rule as everywhere else here, and it is the reason
 * this is a loop rather than a new kind of row.
 */
export async function broadcastMessage(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireActive('admin')
  const body = String(fd.get('body') ?? '').trim()
  const asked = fd.getAll('to').map(String).filter(Boolean)

  if (body.length > 4000) return { error: 'That message is too long.' }
  if (asked.length === 0) return { error: 'Pick who it goes to.' }

  const supabase = await createClient()

  // Never trust the list that came back from the page: only people who
  // are really on the squad, and never yourself.
  const { data: real, error: lookup } = await supabase
    .from('profiles')
    .select('id')
    .eq('status', 'active')
    .neq('id', me.id)
    .in('id', asked)

  if (lookup) return { error: lookup.message }

  const ids = (real ?? []).map((p) => p.id as string)
  if (ids.length === 0) return { error: 'None of those people are on the squad.' }

  const stashed = await stashAttachment(fd.get('file'))
  if ('error' in stashed) return { error: stashed.error }
  if (!body && !stashed.at) return { error: 'Write something, or attach a file.' }

  const { error } = await supabase
    .from('messages')
    .insert(ids.map((id) => ({ subject_id: id, sender_id: me.id, body, ...(stashed.at ?? {}) })))

  if (error) {
    await unstash(stashed.at)
    return { error: error.message }
  }

  revalidatePath('/admin/messages')
  revalidatePath('/messages')
  return {
    ok:
      `Sent to ${ids.length} ${ids.length === 1 ? 'person' : 'people'}, each in their own thread` +
      (stashed.at ? `, with ${stashed.at.file_name}.` : '.'),
  }
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
/** The same, for a file that came attached to a message. */
export async function signedMessageFileUrl(id: string): Promise<string | null> {
  const me = await currentProfile()
  if (!me || me.status !== 'active') return null

  const supabase = await createClient()
  const { data: row } = await supabase
    .from('messages')
    .select('file_path, file_name')
    .eq('id', id)
    .maybeSingle()

  if (!row?.file_path) return null

  const { data } = await createAdminClient()
    .storage.from(BUCKET)
    .createSignedUrl(row.file_path, 60, { download: row.file_name ?? undefined })

  return data?.signedUrl ?? null
}

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
