import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Shell } from '@/app/_components/Shell'
import { Chat } from '@/app/_components/Chat'
import { Notes } from '@/app/_components/Notes'
import { Tasks } from '@/app/_components/Tasks'
import { Files } from '@/app/_components/Files'
import { LeaveSquad } from '@/app/_components/LeaveSquad'
import { RoleSelect, type Person } from '@/app/_components/People'
import { createClient } from '@/lib/supabase/server'
import { requireActive, fullName, type Profile } from '@/lib/auth'
import { loadFiles, loadNotes, loadRoster, loadTasks, loadThread } from '@/lib/hub'
import { TZ_CZ, czTime, usDay, usTime } from '@/lib/time'

export default async function PlayerDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const me = await requireActive('admin')
  const { id } = await params
  const supabase = await createClient()

  const { data: row } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
  if (!row) notFound()
  const player = row as Profile

  const roster = await loadRoster(supabase)
  const [messages, tasks, notes, files, { data: history }] = await Promise.all([
    loadThread(supabase, id, roster),
    loadTasks(supabase, id),
    loadNotes(supabase, id, roster),
    loadFiles(supabase, roster, { playerId: id, viewer: 'staff' }),
    supabase
      .from('bookings')
      .select('id, attended, slots!inner(starts_at, duration_min)')
      .eq('player_id', id)
      .order('starts_at', { referencedTable: 'slots', ascending: false }),
  ])

  type Booking = { id: string; attended: boolean | null; slots: { starts_at: string; duration_min: number } }
  const calls = (history ?? []) as unknown as Booking[]
  const now = Date.now()

  return (
    <Shell profile={me}>
      <div className="row">
        <Link className="btn ghost sm" href="/admin/players">← All players</Link>
      </div>
      <div className="page-h">
        <h2>{fullName(player)}</h2>
        <p>
          {player.email}{player.class_year ? ` · ${player.class_year}` : ''}
          {player.status === 'archived' && <span className="pill warn" style={{ marginLeft: 8 }}>Archived</span>}
        </p>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="hd">
            <h3>Private notes</h3>
            <span className="sub">Winning Minds only — never visible to her or to coaching staff</span>
          </div>
          <Notes notes={notes} playerId={id} />
        </div>

        <div className="card">
          <div className="hd">
            <h3>Tasks</h3>
            <span className="sub">She sees these and ticks them off</span>
          </div>
          <Tasks tasks={tasks} playerId={id} canAssign />
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="hd"><h3>Calls</h3></div>
          {calls.length === 0 ? (
            <div className="bd sm muted">No calls booked yet.</div>
          ) : (
            <div className="list">
              {calls.map((b) => {
                const past = new Date(b.slots.starts_at).getTime() < now
                return (
                  <div className="it" key={b.id}>
                    <div className="grow">
                      <div className="nm num">{usDay(b.slots.starts_at)} · {usTime(b.slots.starts_at)}</div>
                      <div className="xs muted num">
                        {czTime(b.slots.starts_at)} Prague · {b.slots.duration_min} min
                      </div>
                    </div>
                    {past
                      ? <span className={b.attended === false ? 'pill warn' : 'pill plain'}>
                          {b.attended === false ? 'No-show' : 'Done'}
                        </span>
                      : <span className="pill ok">Upcoming</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="hd">
            <h3>Files for her</h3>
            <span className="sub">Private to this player</span>
          </div>
          <Files files={files} canManage fixedPlayerId={id} />
        </div>
      </div>

      <div className="card">
        <div className="hd">
          <h3>Conversation</h3>
          <span className="sub">Direct, one to one</span>
        </div>
        <Chat
          subjectId={id}
          messages={messages}
          meId={me.id}
          tz={TZ_CZ}
          placeholder={`Nothing yet. Write the first message to ${player.first_name}.`}
        />
      </div>

      {!player.is_owner && (
        <div className="card">
          <div className="hd">
            <h3>Role</h3>
            <span className="sub">What she can see and do</span>
            <div style={{ marginLeft: 'auto' }}>
              <RoleSelect
                person={{ id: player.id, name: fullName(player), email: player.email, role: player.role, is_owner: player.is_owner } as Person}
                isOwner={me.is_owner}
              />
            </div>
          </div>
        </div>
      )}

      {!player.is_owner && (
        <LeaveSquad
          id={player.id}
          name={fullName(player)}
          archived={player.status === 'archived'}
        />
      )}
    </Shell>
  )
}
