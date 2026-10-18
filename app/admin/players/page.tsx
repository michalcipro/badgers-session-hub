import Link from 'next/link'
import { Shell } from '@/app/_components/Shell'
import { createClient } from '@/lib/supabase/server'
import { requireActive, fullName, initials, type Profile } from '@/lib/auth'
import { usDay, usTime } from '@/lib/time'
import { AddPerson, RoleSelect, type Person } from '@/app/_components/People'

export default async function PlayersPage() {
  const me = await requireActive('admin')
  const supabase = await createClient()

  const [{ data: profiles }, { data: slots }, { data: tasks }] = await Promise.all([
    supabase.from('profiles').select('*').eq('status', 'active').order('last_name'),
    supabase
      .from('slots')
      .select('starts_at, bookings(player_id)')
      .gt('starts_at', new Date().toISOString())
      .order('starts_at'),
    supabase.from('tasks').select('player_id, done_at'),
  ])

  const people = (profiles ?? []) as Profile[]
  const players = people.filter((p) => p.role === 'player' && p.status === 'active')
  const former = people.filter((p) => p.role === 'player' && p.status === 'archived')
  const staff = people.filter((p) => p.role !== 'player' && p.status === 'active')

  // bookings.slot_id is unique, so this arrives as an object, not an array.
  type B = { player_id: string }
  const nextCall = new Map<string, string>()
  for (const s of (slots ?? []) as { starts_at: string; bookings: B | B[] | null }[]) {
    const b = Array.isArray(s.bookings) ? s.bookings[0] : s.bookings
    if (b && !nextCall.has(b.player_id)) nextCall.set(b.player_id, s.starts_at)
  }

  const openTasks = new Map<string, number>()
  for (const t of (tasks ?? []) as { player_id: string; done_at: string | null }[]) {
    if (!t.done_at) openTasks.set(t.player_id, (openTasks.get(t.player_id) ?? 0) + 1)
  }

  return (
    <Shell profile={me} current="/admin/players">
      <div className="page-h">
        <h2>Players</h2>
        <p>Open a player for her notes, tasks, files and your conversation.</p>
      </div>

      <AddPerson isOwner={me.is_owner} />

      <div className="card">
        <div className="hd">
          <h3>Squad</h3>
          <span className="sub">{players.length} player{players.length === 1 ? '' : 's'}</span>
        </div>
        {players.length === 0 ? (
          <div className="bd sm muted">No players approved yet.</div>
        ) : (
          <div className="list">
            {players.map((p) => {
              const next = nextCall.get(p.id)
              const open = openTasks.get(p.id) ?? 0
              return (
                <Link className="it click" key={p.id} href={`/admin/players/${p.id}`}>
                  <div className="avatar">{initials(p)}</div>
                  <div className="grow">
                    <div className="nm">{fullName(p)}</div>
                    <div className="xs muted trunc">{p.email}</div>
                  </div>
                  {open > 0 && <span className="pill accent num">{open} task{open === 1 ? '' : 's'}</span>}
                  <div className="xs muted num" style={{ textAlign: 'right' }}>
                    {next ? `${usDay(next)} ${usTime(next)}` : <span className="pill plain">Not booked</span>}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {former.length > 0 && (
        <div className="card">
          <div className="hd">
            <h3>Former players</h3>
            <span className="sub">No access, records kept</span>
          </div>
          <div className="list">
            {former.map((p) => (
              <Link className="it click" key={p.id} href={`/admin/players/${p.id}`}>
                <div className="avatar">{initials(p)}</div>
                <div className="grow">
                  <div className="nm">{fullName(p)}</div>
                  <div className="xs muted trunc">{p.email}</div>
                </div>
                <span className="pill warn">Archived</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {staff.length > 0 && (
        <div className="card">
          <div className="hd"><h3>Staff</h3></div>
          <div className="list">
            {staff.map((p) => (
              <div className="it" key={p.id}>
                <div className="avatar">{initials(p)}</div>
                <div className="grow">
                  <div className="nm">{fullName(p)}</div>
                  <div className="xs muted trunc">{p.email}</div>
                </div>
                {p.is_owner && <span className="pill ok">Owner</span>}
                <RoleSelect
                  person={{ id: p.id, name: fullName(p), email: p.email, role: p.role, is_owner: p.is_owner } as Person}
                  isOwner={me.is_owner}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </Shell>
  )
}
