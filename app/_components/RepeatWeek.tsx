'use client'

import { useActionState } from 'react'
import { clearDay, endSeries, repeatWeek, type SeriesResult } from '@/app/series-actions'
import type { SeriesRow } from '@/lib/series'

const day = (key: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(`${key}T00:00:00Z`))

/** Each control answers for itself, so one reply never hides another. */
function Said({ state, inset }: { state: SeriesResult; inset?: boolean }) {
  const text = state.error ?? state.ok
  if (!text) return null
  const note = (
    <div className={state.error ? 'note bad' : 'note ok'} style={{ marginTop: 12 }}>
      {text}
    </div>
  )
  return inset ? <div className="bd" style={{ paddingTop: 0 }}>{note}</div> : note
}

/**
 * Setting a schedule up is three separate thoughts, so it is three
 * separate controls: roll this week forward, stop a schedule early,
 * and take a single day out for a holiday.
 */
export function RepeatWeek({
  weekKey,
  weekLabel,
  slotCount,
  series,
}: {
  weekKey: string
  weekLabel: string
  slotCount: number
  series: SeriesRow[]
}) {
  const [repState, repAction, repPending] = useActionState<SeriesResult, FormData>(repeatWeek, {})
  const [endState, endAction, endPending] = useActionState<SeriesResult, FormData>(endSeries, {})
  const [dayState, dayAction, dayPending] = useActionState<SeriesResult, FormData>(clearDay, {})

  return (
    <div className="card">
      <div className="hd">
        <h3>Repeat this week</h3>
        <span className="sub">
          {slotCount === 0
            ? 'Offer some times above first'
            : `${slotCount} time${slotCount === 1 ? '' : 's'} in ${weekLabel}`}
        </span>
      </div>

      <div className="bd">
        <form action={repAction} className="row" style={{ gap: 12, alignItems: 'flex-end' }}>
          <input type="hidden" name="week" value={weekKey} />
          <label className="fld" style={{ flex: '0 1 200px' }}>
            Keep repeating until
            <input type="date" name="until" required />
          </label>
          <button className="btn primary" type="submit" disabled={repPending || slotCount === 0}>
            {repPending ? 'Filling in…' : 'Repeat weekly'}
          </button>
        </form>
        <p className="xs muted" style={{ marginTop: 8 }}>
          Every time in this week is copied to the same weekday and clock time, week after
          week, up to that date. Times that clash with something already there are skipped.
        </p>

        <Said state={repState} />

        <form action={dayAction} className="row" style={{ gap: 12, alignItems: 'flex-end', marginTop: 16 }}>
          <label className="fld" style={{ flex: '0 1 200px' }}>
            Take a day off
            <input type="date" name="day" required />
          </label>
          <button className="btn ghost" type="submit" disabled={dayPending}>
            {dayPending ? 'Clearing…' : 'Clear that day'}
          </button>
        </form>
        <p className="xs muted" style={{ marginTop: 8 }}>
          For a holiday. Everything still open that day goes; anything already booked stays,
          so nobody turns up to a call you forgot about. A single square you clear by
          clicking it in the grid.
        </p>
        <Said state={dayState} />
      </div>

      <Said state={endState} inset />

      {series.length > 0 && (
        <div className="list">
          {series.map((s) => (
            <div className="it" key={s.id}>
              <div className="grow">
                <div className="nm num">
                  Week of {day(s.source_week)} · repeating until {day(s.ends_on)}
                </div>
                <div className="xs muted">
                  {s.upcoming > 0
                    ? `${s.upcoming} time${s.upcoming === 1 ? '' : 's'} still ahead`
                    : 'Nothing left ahead'}
                </div>
              </div>
              {s.upcoming > 0 && (
                <form action={endAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="btn ghost sm" type="submit" disabled={endPending}>
                    Stop repeating
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
