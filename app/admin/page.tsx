import Link from 'next/link'
import { Shell } from '@/app/_components/Shell'
import { createClient } from '@/lib/supabase/server'
import { requireActive, fullName, initials, type Profile } from '@/lib/auth'
import { approveAccount, declineAccount } from './actions'
import { ConsultationQueue, type PendingConsultation } from '@/app/_components/ConsultationQueue'
import { loadToday } from '@/lib/today'
import { czDay, czTime, usTime } from '@/lib/time'

export default async function AdminPage() {
  const me = await requireActive('admin')
  const supabase = await createClient()

  const [today, { data: pendingRows }, { data: pendingConsults }] = await Promise.all([
    loadToday(supabase, me),
    supabase.from('profiles').select('*').eq('status', 'pending').order('created_at'),
    supabase
      .from('consultations')
      .select('id, requested_at, duration_min, topic, coach_id')
      .eq('status', 'requested')
      .gt('requested_at', new Date().toISOString())
      .order('requested_at'),
  ])

  const pending = (pendingRows ?? []) as Profile[]

  const { data: coaches } = await supabase.from('profiles').select('*').eq('role', 'coach')
  const coachById = new Map(((coaches ?? []) as Profile[]).map((p) => [p.id, p]))
  const consultations: PendingConsultation[] = (
    (pendingConsults ?? []) as {
      id: string; requested_at: string; duration_min: number; topic: string | null; coach_id: string
    }[]
  ).map((c) => {
    const coach = coachById.get(c.coach_id)
    return { ...c, coachName: coach ? fullName(coach) : 'A coach' }
  })

  const now = Date.now()
  const noLink = today.calls.filter((c) => !c.meet_url).length

  return (
    <Shell profile={me}>
      <div className="page-h">
        <h2>Today</h2>
        <p>What is coming, who has not booked, and who is waiting on you.</p>
      </div>

      {pending.length > 0 && (
        <div className="card">
          <div className="hd">
            <h3>Approve access</h3>
            <span className="sub">Nothing is visible to them until you do</span>
          </div>
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
        </div>
      )}

      {consultations.length > 0 && <ConsultationQueue rows={consultations} />}

      <div className="card">
        <div className="hd">
          <h3>Next up</h3>
          <span className="sub">
            {today.calls.length === 0
              ? 'Nothing booked in the next two weeks'
              : `${today.calls.length} call${today.calls.length === 1 ? '' : 's'} in the next two weeks`}
          </span>
          {noLink > 0 && (
            <span className="pill warn" style={{ marginLeft: 'auto' }}>
              {noLink} without a Meet link
            </span>
          )}
        </div>
        {today.calls.length === 0 ? (
          <div className="bd sm muted">
            Offer some times under <Link href="/admin/schedule">Availability</Link> and they will
            appear here as they are taken.
          </div>
        ) : (
          <div className="list">
            {today.calls.slice(0, 12).map((c) => {
              const starts = new Date(c.starts_at).getTime()
              const soon = starts - now < 24 * 3600_000
              return (
                <div className="it" key={c.id}>
                  <div style={{ minWidth: 150 }}>
                    <div className="nm num">{czDay(c.starts_at)} · {czTime(c.starts_at)}</div>
                    <div className="xs muted num">
                      {usTime(c.starts_at)} Madison · {c.duration_min} min
                    </div>
                  </div>
                  <div className="grow">
                    <span className={c.kind === 'consultation' ? 'pill info' : 'pill accent'}>
                      {c.who}
                    </span>
                  </div>
                  {soon && <span className="pill warn">Within 24 h</span>}
                  {c.meet_url ? (
                    <a className="btn sm" href={c.meet_url} target="_blank" rel="noreferrer">
                      Meet
                    </a>
                  ) : (
                    <Link className="btn ghost sm" href="/admin/schedule">Add link</Link>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="grid2">
        <div className="card">
          <div className="hd">
            <h3>Waiting on you</h3>
            <span className="sub">They wrote last</span>
          </div>
          {today.waiting.length === 0 ? (
            <div className="bd sm muted">Nobody is waiting for an answer.</div>
          ) : (
            <div className="list">
              {today.waiting.map((w) => (
                <Link className="it click" key={w.id} href={`/admin/messages?with=${w.id}`}>
                  <div className="grow">
                    <div className="nm">{w.name}</div>
                    <div className="xs muted num">{czDay(w.at)} · {czTime(w.at)}</div>
                  </div>
                  <span className="pill ok">Reply</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="hd">
            <h3>Nothing booked</h3>
            <span className="sub">
              {today.idle.length} of the squad {today.idle.length === 1 ? 'has' : 'have'} no call ahead
            </span>
          </div>
          {today.idle.length === 0 ? (
            <div className="bd sm muted">Everybody has a call booked.</div>
          ) : (
            <div className="list">
              {today.idle.map((p) => (
                <Link className="it click" key={p.id} href={`/admin/messages?with=${p.id}`}>
                  <div className="grow"><div className="nm">{p.name}</div></div>
                  <span className="pill warn">Nudge</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Shell>
  )
}
