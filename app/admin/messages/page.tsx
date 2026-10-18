import Link from 'next/link'
import { Shell } from '@/app/_components/Shell'
import { Chat } from '@/app/_components/Chat'
import { createClient } from '@/lib/supabase/server'
import { requireActive, fullName, initials, type Profile } from '@/lib/auth'
import { loadRoster, loadThread } from '@/lib/hub'
import { TZ_CZ } from '@/lib/time'

export default async function AdminMessages({
  searchParams,
}: {
  searchParams: Promise<{ with?: string }>
}) {
  const me = await requireActive('admin')
  const { with: withId } = await searchParams
  const supabase = await createClient()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .eq('status', 'active')
    .neq('id', me.id)
    .order('last_name')

  const people = (profiles ?? []) as Profile[]
  const selected = people.find((p) => p.id === withId) ?? people[0]

  const roster = await loadRoster(supabase)
  const messages = selected ? await loadThread(supabase, selected.id, roster) : []

  // Who is waiting on a reply: the last message in their thread is theirs.
  const { data: last } = await supabase
    .from('messages')
    .select('subject_id, sender_id, created_at')
    .order('created_at', { ascending: false })

  const waiting = new Set<string>()
  const seen = new Set<string>()
  for (const m of (last ?? []) as { subject_id: string; sender_id: string }[]) {
    if (seen.has(m.subject_id)) continue
    seen.add(m.subject_id)
    if (m.sender_id === m.subject_id) waiting.add(m.subject_id)
  }

  return (
    <Shell profile={me} current="/admin/messages">
      <div className="page-h">
        <h2>Messages</h2>
        <p>One thread per person. Nobody sees anyone else&rsquo;s.</p>
      </div>

      {people.length === 0 ? (
        <div className="card"><div className="bd sm muted">Nobody to write to yet.</div></div>
      ) : (
        <div className="split">
          <div className="card">
            <div className="list">
              {people.map((p) => (
                <Link
                  className="it click"
                  key={p.id}
                  href={`/admin/messages?with=${p.id}`}
                  style={selected?.id === p.id ? { background: 'var(--accent-soft)' } : undefined}
                >
                  <div className="avatar">{initials(p)}</div>
                  <div className="grow">
                    <div className="nm trunc">{fullName(p)}</div>
                    <div className="xs muted">{p.role === 'player' ? 'Player' : p.role === 'coach' ? 'Coach' : 'Winning Minds'}</div>
                  </div>
                  {waiting.has(p.id) && <span className="pill ok">New</span>}
                </Link>
              ))}
            </div>
          </div>

          <div className="card">
            {selected && (
              <>
                <div className="hd">
                  <h3>{fullName(selected)}</h3>
                  {selected.role === 'player' && (
                    <Link className="btn ghost sm" style={{ marginLeft: 'auto' }} href={`/admin/players/${selected.id}`}>
                      Open profile
                    </Link>
                  )}
                </div>
                <Chat subjectId={selected.id} messages={messages} meId={me.id} tz={TZ_CZ} />
              </>
            )}
          </div>
        </div>
      )}
    </Shell>
  )
}
