import { Shell } from '@/app/_components/Shell'
import { WeekCalendar } from '@/app/_components/WeekCalendar'
import { createClient } from '@/lib/supabase/server'
import { requireActive } from '@/lib/auth'
import { sessionMin } from '@/lib/settings'
import { loadWeekSlots } from '@/lib/slots'
import { hourRange, weekRange, weekStartFor } from '@/lib/week'
import { TZ_US, czTime, usDay, usTime } from '@/lib/time'

export default async function PlayerPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const me = await requireActive('player')
  const { week } = await searchParams

  const weekStart = weekStartFor(week, TZ_US)
  const { fromISO, toISO } = weekRange(weekStart, TZ_US)

  const supabase = await createClient()
  const slots = await loadWeekSlots(supabase, fromISO, toISO, 'player', me.id)

  // The next call this player holds, whichever week it is in.
  const { data: nextRows } = await supabase
    .from('slots')
    .select('id, starts_at, duration_min, meet_url, bookings!inner(player_id)')
    .eq('bookings.player_id', me.id)
    .gt('starts_at', new Date().toISOString())
    .order('starts_at')
    .limit(1)

  const next = (nextRows ?? [])[0] as
    | { starts_at: string; duration_min: number; meet_url: string | null }
    | undefined

  const joinable = next
    ? Date.now() >= new Date(next.starts_at).getTime() - 10 * 60_000
    : false

  // Her own record. Only ever her own rows — row-level security sees to that.
  const { data: mine } = await supabase
    .from('bookings')
    .select('attended, slots!inner(starts_at)')
    .eq('player_id', me.id)
    .lt('slots.starts_at', new Date().toISOString())

  const pastCalls = (mine ?? []) as unknown as { attended: boolean | null }[]
  const came = pastCalls.filter((b) => b.attended === true).length
  const missed = pastCalls.filter((b) => b.attended === false).length

  return (
    <Shell profile={me}>
      <div className="page-h">
        <h2>Hi, {me.first_name}</h2>
        <p>All times here are shown in Madison time.</p>
      </div>

      {next ? (
        <div className="card" style={{ borderColor: 'var(--accent-line)', background: 'var(--accent-soft)' }}>
          <div className="bd">
            <div className="eyebrow" style={{ color: 'var(--accent)' }}>Your next call</div>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8 }}>
              <div>
                <div className="num" style={{ fontFamily: 'var(--display)', fontSize: 26, fontWeight: 700 }}>
                  {usDay(next.starts_at)} · {usTime(next.starts_at)}
                </div>
                <div className="sm num" style={{ color: 'var(--accent)' }}>
                  {next.duration_min} minutes · {czTime(next.starts_at)} in Prague
                </div>
              </div>
              {next.meet_url && joinable ? (
                <a className="btn primary" href={next.meet_url} target="_blank" rel="noreferrer">
                  Join Google Meet
                </a>
              ) : (
                <span className="pill accent">
                  {next.meet_url ? 'Join opens 10 min before' : 'Link coming before the call'}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="note bad">
          <span>◎</span>
          <div><b>You have no call booked.</b> Pick a green time below — first come, first served.</div>
        </div>
      )}

      {pastCalls.length > 0 && (
        <div className="grid3">
          <div className="stat">
            <div className="v num">{came}</div>
            <div className="k">Calls you have had</div>
          </div>
          {missed > 0 && (
            <div className="stat">
              <div className="v num">{missed}</div>
              <div className="k">Missed</div>
            </div>
          )}
        </div>
      )}

      <WeekCalendar
        mode="player"
        tz={TZ_US}
        weekStart={weekStart}
        basePath="/player"
        slots={slots}
        hours={hourRange(slots, TZ_US, [8, 16])}
        meId={me.id}
        nowISO={new Date().toISOString()}
        lengthMin={await sessionMin(supabase)}
      />
    </Shell>
  )
}
