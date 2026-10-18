import { Shell } from '@/app/_components/Shell'
import { createClient } from '@/lib/supabase/server'
import { requireActive, fullName, initials, type Profile } from '@/lib/auth'
import { approveAccount, declineAccount } from './actions'

const ROLE_LABEL: Record<Profile['role'], string> = {
  admin: 'Winning Minds',
  coach: 'Coach',
  player: 'Player',
}

export default async function AdminPage() {
  const me = await requireActive('admin')
  const supabase = await createClient()

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })

  const everyone = (data ?? []) as Profile[]
  const pending = everyone.filter((p) => p.status === 'pending')
  const active = everyone.filter((p) => p.status === 'active')
  const players = active.filter((p) => p.role === 'player')

  return (
    <Shell profile={me}>
      <div className="page-h">
        <h2>Today</h2>
        <p>Approve who gets in, and keep an eye on the roster.</p>
      </div>

      <div className="card">
        <div className="hd">
          <h3>Approve access</h3>
          <span className="sub">
            They signed up with an email and password. Nothing is visible to them until you approve.
          </span>
        </div>
        {pending.length === 0 ? (
          <div className="bd sm muted">Nobody is waiting.</div>
        ) : (
          <div className="list">
            {pending.map((p) => (
              <div className="it" key={p.id}>
                <div className="avatar">{initials(p)}</div>
                <div className="grow">
                  <div className="nm">{fullName(p)}</div>
                  <div className="xs muted trunc">{p.email}</div>
                </div>
                <form action={approveAccount} className="row" style={{ gap: 8 }}>
                  <input type="hidden" name="id" value={p.id} />
                  <select name="role" defaultValue="player" style={{ width: 'auto' }}>
                    <option value="player">Player</option>
                    <option value="coach">Coach</option>
                    <option value="admin">Winning Minds</option>
                  </select>
                  <button className="btn primary sm" type="submit">Approve</button>
                </form>
                <form action={declineAccount}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="btn ghost sm" type="submit">Decline</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="hd">
          <h3>Roster</h3>
          <span className="sub">
            {players.length} player{players.length === 1 ? '' : 's'} · {active.length} accounts in total
          </span>
        </div>
        {active.length === 0 ? (
          <div className="bd sm muted">No approved accounts yet.</div>
        ) : (
          <div className="list">
            {active.map((p) => (
              <div className="it" key={p.id}>
                <div className="avatar">{initials(p)}</div>
                <div className="grow">
                  <div className="nm">{fullName(p)}</div>
                  <div className="xs muted trunc">{p.email}</div>
                </div>
                <span className={p.role === 'player' ? 'pill plain' : 'pill accent'}>
                  {ROLE_LABEL[p.role]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="note warn">
        <span>→</span>
        <div>
          <b>Next step:</b> the availability calendar and booking, then the confirmation
          and 24-hour reminder emails.
        </div>
      </div>
    </Shell>
  )
}
