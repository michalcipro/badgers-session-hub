import Link from 'next/link'
import { Shell } from '@/app/_components/Shell'
import { Chat } from '@/app/_components/Chat'
import { Broadcast } from '@/app/_components/Broadcast'
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
    .order('last_name')

  const everyone = (profiles ?? []) as Profile[]
  // Your own thread is where anything written TO you lands, including a
  // message from the other half of Winning Minds. Leaving it out of this
  // list is how it went unread.
  const others = everyone.filter((p) => p.id !== me.id)
  const threads = [...everyone.filter((p) => p.id === me.id), ...others]
  const selected = threads.find((p) => p.id === withId) ?? others[0] ?? threads[0]

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
    // Somebody else had the last word: in their thread that is them, and
    // in your own it is whoever wrote to you.
    const theirs = m.subject_id === me.id ? m.sender_id !== me.id : m.sender_id === m.subject_id
    if (theirs) waiting.add(m.subject_id)
  }

  return (
    <Shell profile={me}>
      <div className="page-h">
        <h2>Messages</h2>
        <p>One thread per person. Nobody sees anyone else&rsquo;s.</p>
      </div>

      {others.length > 1 && (
        <Broadcast
          people={others.map((p) => ({ id: p.id, name: fullName(p), role: p.role }))}
        />
      )}

      {others.length === 0 ? (
        <div className="card"><div className="bd sm muted">Nobody to write to yet.</div></div>
      ) : (
        <div className="split">
          <div className="card">
            <div className="list">
              {threads.map((p) => (
                <Link
                  className="it click"
                  key={p.id}
                  href={`/admin/messages?with=${p.id}`}
                  style={selected?.id === p.id ? { background: 'var(--accent-soft)' } : undefined}
                >
                  <div className="avatar">{initials(p)}</div>
                  <div className="grow">
                    <div className="nm trunc">{p.id === me.id ? 'You' : fullName(p)}</div>
                    <div className="xs muted">
                      {p.id === me.id
                        ? 'Written to you'
                        : p.role === 'player' ? 'Player' : p.role === 'coach' ? 'Coach' : 'Winning Minds'}
                    </div>
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
                  <h3>{selected.id === me.id ? 'Written to you' : fullName(selected)}</h3>
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
