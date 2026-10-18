import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from './auth'

/** What the navigation should be shouting about, by href. */
export type Badges = Record<string, number | true>

/**
 * A tool somebody opens once a fortnight has to say, on the way in, that
 * something is waiting — otherwise she has to go looking, and so she
 * does not.
 *
 * "Unread" means written by somebody else since she last opened the
 * page. Tasks need no such memory: an open task is open until she ticks
 * it off.
 */
export async function loadBadges(
  supabase: SupabaseClient,
  me: Profile
): Promise<Badges> {
  if (me.role === 'admin') return {}

  const unreadQuery = supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('subject_id', me.id)
    .neq('sender_id', me.id)

  const [{ count: unread }, { count: open }] = await Promise.all([
    me.messages_seen_at ? unreadQuery.gt('created_at', me.messages_seen_at) : unreadQuery,
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', me.id)
      .is('done_at', null),
  ])

  const badges: Badges = {}
  if (unread && unread > 0) badges['/messages'] = unread
  if (open && open > 0) badges['/tasks'] = open
  return badges
}

/** Called when she opens the page the messages are on. */
export async function markMessagesSeen(supabase: SupabaseClient, me: Profile) {
  await supabase
    .from('profiles')
    .update({ messages_seen_at: new Date().toISOString() })
    .eq('id', me.id)
}
