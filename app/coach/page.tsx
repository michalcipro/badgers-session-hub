import { Shell } from '@/app/_components/Shell'
import { createClient } from '@/lib/supabase/server'
import { requireActive, initials } from '@/lib/auth'

type RosterRow = {
  id: string
  first_name: string
  last_name: string
  role: 'admin' | 'coach' | 'player'
  class_year: string | null
}

export default async function CoachPage() {
  const me = await requireActive('coach')
  const supabase = await createClient()

  // The roster view hands out names and role, nothing else — a coach can
  // never read notes, tasks, files or messages.
  const { data } = await supabase
    .from('roster')
    .select('id, first_name, last_name, role, class_year')
    .eq('role', 'player')
    .order('last_name')

  const players = (data ?? []) as RosterRow[]

  return (
    <Shell profile={me}>
      <div className="page-h">
        <h2>Team overview</h2>
        <p>Bookings and attendance only. What is said in a session stays between the player and Winning Minds.</p>
      </div>

      <div className="card">
        <div className="hd">
          <h3>Squad</h3>
          <span className="sub">{players.length} player{players.length === 1 ? '' : 's'}</span>
        </div>
        {players.length === 0 ? (
          <div className="bd sm muted">No players approved yet.</div>
        ) : (
          <div className="list">
            {players.map((p) => (
              <div className="it" key={p.id}>
                <div className="avatar">{initials(p)}</div>
                <div className="grow">
                  <div className="nm">{p.first_name} {p.last_name}</div>
                  <div className="xs muted">{p.class_year ?? '—'}</div>
                </div>
                <span className="pill plain">No calls yet</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  )
}
