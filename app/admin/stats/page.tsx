import Link from 'next/link'
import { Shell } from '@/app/_components/Shell'
import { createClient } from '@/lib/supabase/server'
import { requireActive } from '@/lib/auth'
import { loadStats } from '@/lib/stats'
import { czDay, czTime, usDay, usTime } from '@/lib/time'

const Stat = ({ value, label, note }: { value: string; label: string; note?: string }) => (
  <div className="stat">
    <div className="v num">{value}</div>
    <div className="k">{label}</div>
    {note && <div className="k faint" style={{ marginTop: 2 }}>{note}</div>}
  </div>
)

export default async function StatsPage() {
  const me = await requireActive('admin')
  const supabase = await createClient()
  const { sessions, players, weeks, totals } = await loadStats(supabase)

  const held = sessions.filter((s) => s.past && s.playerId)
  const noLink = sessions.filter((s) => !s.past && s.playerId && !s.hasLink).length

  return (
    <Shell profile={me}>
      <div className="page-h">
        <h2>Statistics</h2>
        <p>Counted from bookings and attendance. Nothing from inside a session is involved.</p>
      </div>

      {totals.held === 0 ? (
        <div className="card"><div className="bd sm muted">
          No calls have happened yet. Numbers appear here once the first ones are done.
        </div></div>
      ) : (
        <div className="grid3">
          <Stat value={String(totals.held)} label="Calls held" note={`${totals.upcoming} still upcoming`} />
          <Stat
            value={totals.attendanceRate === null ? '—' : `${totals.attendanceRate}%`}
            label="Attendance"
            note={`${totals.attended} came · ${totals.missed} missed`}
          />
          <Stat
            value={totals.fillRate === null ? '—' : `${totals.fillRate}%`}
            label="Times taken"
            note={`${totals.booked} of ${totals.offered} offered`}
          />
          <Stat
            value={String(totals.unmarked)}
            label="Not marked yet"
            note={totals.unmarked > 0 ? 'Mark them in Availability' : 'All up to date'}
          />
        </div>
      )}

      {(totals.unmarked > 0 || noLink > 0) && (
        <div className="note warn">
          <span>→</span>
          <div>
            {totals.unmarked > 0 && (
              <>
                <b>{totals.unmarked} call{totals.unmarked === 1 ? '' : 's'} without attendance marked.</b>{' '}
                Until you mark them, they count towards nothing.{' '}
              </>
            )}
            {noLink > 0 && (
              <>{noLink} upcoming call{noLink === 1 ? '' : 's'} still {noLink === 1 ? 'has' : 'have'} no Meet link.</>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="hd">
          <h3>By player</h3>
          <span className="sub">{players.length} player{players.length === 1 ? '' : 's'}</span>
        </div>
        {players.length === 0 ? (
          <div className="bd sm muted">No players yet.</div>
        ) : (
          <div className="scrollx">
            <table className="mx">
              <thead>
                <tr>
                  <th>Player</th>
                  <th className="c">Came</th>
                  <th className="c">Missed</th>
                  <th className="c">Attendance</th>
                  <th className="c">Tasks</th>
                  <th>Last call</th>
                  <th>Next call</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/players/${p.id}`} className="nm">{p.name}</Link>
                    </td>
                    <td className="c num">{p.attended}</td>
                    <td className="c num">
                      {p.missed > 0 ? <span style={{ color: 'var(--warn)', fontWeight: 600 }}>{p.missed}</span> : '0'}
                    </td>
                    <td className="c num">{p.rate === null ? <span className="faint">—</span> : `${p.rate}%`}</td>
                    <td className="c num">
                      {p.openTasks > 0
                        ? <span className="pill accent">{p.openTasks} open</span>
                        : <span className="faint">{p.doneTasks > 0 ? 'all done' : '—'}</span>}
                    </td>
                    <td className="num xs">{p.lastCall ? usDay(p.lastCall) : <span className="faint">never</span>}</td>
                    <td className="num xs">
                      {p.nextCall
                        ? `${usDay(p.nextCall)} ${usTime(p.nextCall)}`
                        : <span className="pill plain">not booked</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {held.length > 0 && (
        <div className="card">
          <div className="hd">
            <h3>Every call</h3>
            <span className="sub">Most recent first</span>
          </div>
          <div className="scrollx">
            <table className="mx">
              <thead>
                <tr>
                  <th>When (Prague)</th>
                  <th>Her time</th>
                  <th>Player</th>
                  <th className="c">Length</th>
                  <th>Attendance</th>
                </tr>
              </thead>
              <tbody>
                {held.slice(0, 50).map((s) => (
                  <tr key={s.slotId}>
                    <td className="num">{czDay(s.startsAt)} · {czTime(s.startsAt)}</td>
                    <td className="num xs muted">{usTime(s.startsAt)}</td>
                    <td>{s.playerName}</td>
                    <td className="c num">{s.durationMin} min</td>
                    <td>
                      {s.attended === true && <span className="pill ok">Came</span>}
                      {s.attended === false && <span className="pill warn">No-show</span>}
                      {s.attended === null && <span className="pill plain">Not marked</span>}
                    </td>
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
