import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatMessage } from '@/app/_components/Chat'
import type { FileRow } from '@/app/_components/Files'
import type { NoteRow } from '@/app/_components/Notes'
import type { TaskRow } from '@/app/_components/Tasks'
import { fullName, shortName } from './auth'

export type RosterRow = {
  id: string
  first_name: string
  last_name: string
  role: 'admin' | 'coach' | 'player'
  class_year: string | null
  title: string | null
}

export async function loadRoster(supabase: SupabaseClient): Promise<Map<string, RosterRow>> {
  const { data } = await supabase
    .from('roster')
    .select('id, first_name, last_name, role, class_year, title')
  const map = new Map<string, RosterRow>()
  for (const r of (data ?? []) as RosterRow[]) map.set(r.id, r)
  return map
}

export async function loadThread(
  supabase: SupabaseClient,
  subjectId: string,
  roster: Map<string, RosterRow>
): Promise<ChatMessage[]> {
  const { data } = await supabase
    .from('messages')
    .select('id, body, created_at, sender_id, file_name, file_size')
    .eq('subject_id', subjectId)
    .order('created_at')

  type Row = {
    id: string
    body: string
    created_at: string
    sender_id: string
    file_name: string | null
    file_size: number | null
  }

  return ((data ?? []) as Row[]).map((m) => {
    const who = roster.get(m.sender_id)
    return {
      ...m,
      sender_name: who ? who.first_name : 'Winning Minds',
      from_winning_minds: who?.role === 'admin',
    }
  })
}

export async function loadTasks(supabase: SupabaseClient, playerId: string): Promise<TaskRow[]> {
  const { data } = await supabase
    .from('tasks')
    .select('id, title, due_on, done_at')
    .eq('player_id', playerId)
    .order('due_on', { nullsFirst: false })
  return (data ?? []) as TaskRow[]
}

export async function loadNotes(
  supabase: SupabaseClient,
  playerId: string,
  roster: Map<string, RosterRow>
): Promise<NoteRow[]> {
  const { data } = await supabase
    .from('notes')
    .select('id, body, created_at, author_id')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })

  return ((data ?? []) as { id: string; body: string; created_at: string; author_id: string | null }[])
    .map((n) => ({
      id: n.id,
      body: n.body,
      created_at: n.created_at,
      author_name: n.author_id ? (roster.get(n.author_id)?.first_name ?? 'Winning Minds') : 'Winning Minds',
    }))
}

/**
 * Files this viewer may have. Row-level security already limits the rows;
 * the audience label is only how it is described on screen.
 */
export async function loadFiles(
  supabase: SupabaseClient,
  roster: Map<string, RosterRow>,
  opts: { playerId?: string; viewer: 'staff' | 'player' } = { viewer: 'player' }
): Promise<FileRow[]> {
  let query = supabase
    .from('files')
    .select('id, name, size_bytes, visible_to, created_at')
    .order('created_at', { ascending: false })

  if (opts.playerId) query = query.eq('visible_to', opts.playerId)

  const { data } = await query
  return ((data ?? []) as Omit<FileRow, 'audience'>[]).map((f) => {
    let audience = 'Team'
    if (f.visible_to) {
      if (opts.viewer === 'staff') {
        const who = roster.get(f.visible_to)
        audience = who ? shortName(who) : 'Private'
      } else {
        audience = 'For you'
      }
    }
    return { ...f, audience }
  })
}

export const displayName = (r: RosterRow | undefined) => (r ? fullName(r) : 'Unknown')
