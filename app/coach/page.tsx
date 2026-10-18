import { Shell } from '@/app/_components/Shell'
import { createClient } from '@/lib/supabase/server'
import { requireActive, initials } from '@/lib/auth'
import { loadStats } from '@/lib/stats'
import { usDay, usTime } from '@/lib/time'

export default async function CoachPage() {
  const me = await requireActive('coach')
  const supabase = await createClient()
  const { players, totals, weeks } = await loadStats(supabase)

  const booked = players.filter((p) => p.nextCall).length
  const nameParts = (full: string) => {
    const bits = full.split(' ')
    return { first: bits[0] ?? full, last: bits.slice(1).join(' ') }
  }

  return (
    <Shell profile={me} current="/coach">
      <div className="page-h">
        <h2>Team overview</h2>
        <p>Who is booked and who turns up. What is said in a session stays between the player and Winning Minds.</p>
      </div>

      <div className="grid3">
        <div className="stat">
          <div className="v num">{booked}/{players.length}</div>
          <div className="k">Booked for the next round</div>
        </div>
        <div className="stat">
          <div className="v num">{totals.attendanceRate === null ? '—' : `${totals.attendanceRate}%`}</div>
          <div className="k">Attendance so far</div>
        </div>
        <div className="stat">
          <div className="v num">{totals.held}</div>
          <div className="k">Calls held</div>
        </div>
      </div>

      <div className="note ok">
        <span>🔒</span>
        <div>
          You see names, times and attendance. Session notes, tasks, files and the messages
          between a player and Winning Minds are not visible to coaching staff.
        </div>
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
            {players.map((p) => {
              const { first, last } = nameParts(p.name)
              return (
                <div className="it" key={p.id}>
                  <div className="avatar">{initials({ first_name: first, last_name: last })}</div>
                  <div className="grow">
                    <div className="nm">{p.name}</div>
                    <div className="xs muted num">
                      {p.attended} attended
                      {p.missed > 0 && <span style={{ color: 'var(--warn)' }}> · {p.missed} missed</span>}
                      {p.rate !== null && ` · ${p.rate}%`}
                      {p.booked === 0 && 'no calls yet'}
                    </div>
                  </div>
                  {p.nextCall ? (
                    <>
                      <div className="xs num" style={{ textAlign: 'right' }}>
                        {usDay(p.nextCall)}<br />
                        <span className="muted">{usTime(p.nextCall)}</span>
                      </div>
                      <span className="pill ok">Booked</span>
                    </>
                  ) : (
                    <span className="pill warn">Not booked</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {weeks.length > 0 && (
        <div className="card">
          <div className="hd"><h3>By week</h3></div>
          <div className="scrollx">
            <table className="mx">
              <thead>
                <tr>
                  <th>Week</th>
                  <th className="c">Offered</th>
                  <th className="c">Taken</th>
                  <th className="c">Came</th>
                  <th className="c">Missed</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.key}>
                    <td className="num">
                      {w.label}{!w.past && <span className="pill ok" style={{ marginLeft: 8 }}>upcoming</span>}
                    </td>
                    <td className="c num">{w.offered}</td>
                    <td className="c num">{w.booked}</td>
                    <td className="c num">{w.attended}</td>
                    <td className="c num">{w.missed || <span className="faint">0</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Shell>
  )
}
