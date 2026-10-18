'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import {
  addDays, calFmt, czTime, dayKey, gapHours, hourLabel,
  minutesInDay, timeIn, usDay, usTime, type CalDate,
} from '@/lib/time'
import type { SlotRow } from '@/lib/week'
import {
  bookSlot, cancelBooking, createSlot, deleteSlot,
  type ActionResult,
} from '@/app/slot-actions'

const STEP = 15            // minutes per click target
const HOUR_H = 64          // pixels per hour
const COMPACT_H = 36       // below this a block only has room for one line

type Props = {
  mode: 'admin' | 'player'
  tz: string
  weekStart: CalDate
  basePath: string
  slots: SlotRow[]
  hours: [number, number]
  meId: string
  nowISO: string
}

export function WeekCalendar(props: Props) {
  const { mode, tz, weekStart, basePath, slots, hours, meId, nowISO } = props
  const [startH, endH] = hours
  const rows = endH - startH
  const now = new Date(nowISO).getTime()

  const [duration, setDuration] = useState(45)
  const [confirm, setConfirm] = useState<SlotRow | null>(null)

  const [addState, addAction] = useActionState<ActionResult, FormData>(createSlot, {})
  const [delState, delAction] = useActionState<ActionResult, FormData>(deleteSlot, {})
  const [bookState, bookAction] = useActionState<ActionResult, FormData>(bookSlot, {})
  const [cancelState, cancelAction] = useActionState<ActionResult, FormData>(cancelBooking, {})

  const error = addState.error ?? delState.error ?? bookState.error ?? cancelState.error

  // Close the confirmation once the booking has gone through.
  useEffect(() => {
    if (bookState.ok) setConfirm(null)
  }, [bookState.ok])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirm(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const prev = dayKey(addDays(weekStart, -7))
  const next = dayKey(addDays(weekStart, 7))
  const label =
    `${calFmt(weekStart, { month: 'short', day: 'numeric' })} – ` +
    `${calFmt(addDays(weekStart, 6), { month: 'short', day: 'numeric' })}`

  const gap = gapHours(new Date(Date.UTC(weekStart.y, weekStart.m - 1, weekStart.d, 12)))
  const todayKey = dayKey({
    y: +new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric' }).format(now),
    m: +new Intl.DateTimeFormat('en-GB', { timeZone: tz, month: '2-digit' }).format(now),
    d: +new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: '2-digit' }).format(now),
  })

  const top = (iso: string) => ((minutesInDay(iso, tz) - startH * 60) / 60) * HOUR_H
  const height = (min: number) => Math.max(18, (min / 60) * HOUR_H - 2)

  const slotsOn = (d: CalDate) => {
    const key = dayKey(d)
    return slots.filter((s) => {
      const p = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(new Date(s.starts_at))
      const o: Record<string, string> = {}
      for (const x of p) o[x.type] = x.value
      return `${o.year}-${o.month}-${o.day}` === key
    })
  }

  const freeCount = slots.filter((s) => !s.booking_id && new Date(s.starts_at).getTime() > now).length
  const mySlot = slots.find((s) => s.booked_by === meId)

  return (
    <>
      {gap !== 7 && (
        <div className="note warn">
          <span>⚠</span>
          <div>
            <b>Prague and Madison are {gap} hours apart this week, not the usual 7.</b>{' '}
            The EU and the US change clocks on different dates. Everything here is already
            converted — do not re-count by hand.
          </div>
        </div>
      )}

      {error && <div className="note bad"><span>✕</span><div>{error}</div></div>}

      <div className="card">
        <div className="hd">
          <div className="weeknav">
            <Link className="btn sm" href={`${basePath}?week=${prev}`} aria-label="Previous week">←</Link>
            <span className="lbl">{label}</span>
            <Link className="btn sm" href={`${basePath}?week=${next}`} aria-label="Next week">→</Link>
            <Link className="btn ghost sm" href={basePath}>This week</Link>
          </div>
          <span className="sub num">
            {mode === 'admin'
              ? `${slots.length} time${slots.length === 1 ? '' : 's'} · ${slots.filter(s => s.booking_id).length} booked`
              : `${freeCount} free ${freeCount === 1 ? 'time' : 'times'} this week`}
          </span>
          {mode === 'admin' && (
            <label className="fld" style={{ marginLeft: 'auto', flex: '0 0 108px' }}>
              Length
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                style={{ width: 'auto' }}
              >
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
              </select>
            </label>
          )}
        </div>

        <div className="calwrap">
          <div className="cal">
            <div className="cal-corner" />
            {days.map((d) => (
              <div className={`cal-dh${dayKey(d) === todayKey ? ' today' : ''}`} key={dayKey(d)}>
                <div className="dw">{calFmt(d, { weekday: 'short' })}</div>
                <div className="dd">{d.d}</div>
              </div>
            ))}

            <div className="cal-times">
              {Array.from({ length: rows }, (_, i) => (
                <div className="cal-hour" key={i}>
                  <span>{hourLabel(startH + i, tz)}</span>
                </div>
              ))}
            </div>

            {days.map((d) => {
              const dk = dayKey(d)
              const mine = slotsOn(d)
              return (
                <div className="cal-col" key={dk} style={{ height: rows * HOUR_H }}>
                  {Array.from({ length: rows }, (_, i) => (
                    <div key={`h${i}`} className="hr" style={{ top: i * HOUR_H }} />
                  ))}
                  {Array.from({ length: rows }, (_, i) => (
                    <div key={`hh${i}`} className="hr half" style={{ top: i * HOUR_H + HOUR_H / 2 }} />
                  ))}

                  {mode === 'admin' &&
                    Array.from({ length: (rows * 60) / STEP }, (_, i) => {
                      const minute = startH * 60 + i * STEP
                      return (
                        <form action={addAction} key={`a${i}`}>
                          <input type="hidden" name="date" value={dk} />
                          <input type="hidden" name="minute" value={minute} />
                          <input type="hidden" name="duration" value={duration} />
                          <button
                            type="submit"
                            className="cal-add"
                            style={{ top: (i * STEP * HOUR_H) / 60, height: (STEP * HOUR_H) / 60 }}
                            aria-label={`Offer ${calFmt(d, { weekday: 'long' })} ${hourLabel(Math.floor(minute / 60), tz)}`}
                          />
                        </form>
                      )
                    })}

                  {mine.map((s) => {
                    const past = new Date(s.starts_at).getTime() <= now
                    const isMine = s.booked_by === meId
                    const cls = past ? 'past' : isMine ? 'mine' : s.booking_id ? 'taken' : 'free'
                    const h = height(s.duration_min)
                    const style = { top: top(s.starts_at), height: h }
                    const who = s.booked_name ?? (past ? 'Not used' : 'Free')
                    const body =
                      h < COMPACT_H ? (
                        <span className="t" style={{ fontSize: 10.5 }}>
                          {timeIn(s.starts_at, tz)} · {who}
                        </span>
                      ) : (
                        <>
                          <span className="t">{timeIn(s.starts_at, tz)}</span>
                          <span className="n">
                            {s.booked_name ?? (past ? 'Not used' : `Free · ${s.duration_min} min`)}
                          </span>
                        </>
                      )

                    if (mode === 'admin' && !s.booking_id && !past) {
                      return (
                        <form action={delAction} key={s.id}>
                          <input type="hidden" name="id" value={s.id} />
                          <button type="submit" className="cal-ev free can" style={style}
                            title={`${czTime(s.starts_at)} Prague · ${usTime(s.starts_at)} Madison — click to withdraw`}>
                            {body}
                          </button>
                        </form>
                      )
                    }

                    if (mode === 'player' && !s.booking_id && !past) {
                      return (
                        <button key={s.id} type="button" className="cal-ev free can" style={style}
                          onClick={() => setConfirm(s)}
                          title={`${czTime(s.starts_at)} in Prague`}>
                          {body}
                        </button>
                      )
                    }

                    if (mode === 'player' && isMine && !past) {
                      return (
                        <button key={s.id} type="button" className="cal-ev mine" style={style}
                          onClick={() => setConfirm(s)}
                          title={`${czTime(s.starts_at)} in Prague`}>
                          <span className="t">{timeIn(s.starts_at, tz)}</span>
                          <span className="n">Your call</span>
                        </button>
                      )
                    }

                    return (
                      <div key={s.id} className={`cal-ev ${cls}`} style={style}
                        title={`${czTime(s.starts_at)} Prague · ${usTime(s.starts_at)} Madison`}>
                        {body}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        <div className="bd" style={{ borderTop: '1px solid var(--line)' }}>
          <p className="xs muted">
            {mode === 'admin'
              ? 'Rows are your own Prague time. Click an empty square to offer it, click a green one to withdraw it. Players only ever see the green squares.'
              : 'Times are yours in Madison; hover a time to see it in Prague. Tap a green time to take it — you confirm once and you are booked. Teammates see only each other’s names.'}
          </p>
        </div>
      </div>

      {confirm && (
        <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) setConfirm(null) }}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="mb">
              <div className="eyebrow">
                {confirm.booked_by === meId ? 'Release this time?' : 'Confirm your call'}
              </div>
              <div className="big">
                {calFmt(
                  {
                    y: +new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric' }).format(new Date(confirm.starts_at)),
                    m: +new Intl.DateTimeFormat('en-GB', { timeZone: tz, month: '2-digit' }).format(new Date(confirm.starts_at)),
                    d: +new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: '2-digit' }).format(new Date(confirm.starts_at)),
                  },
                  { weekday: 'long', month: 'short', day: 'numeric' }
                )}{' '}
                · {usTime(confirm.starts_at)}
              </div>
              <p className="sm muted num" style={{ marginTop: 5 }}>
                {confirm.duration_min} minutes · {czTime(confirm.starts_at)} in Prague
              </p>
              {confirm.booked_by === meId ? (
                <p className="sm muted" style={{ marginTop: 12 }}>
                  It goes back into the pool and a teammate can take it.
                </p>
              ) : mySlot ? (
                <div className="note warn" style={{ marginTop: 14 }}>
                  <span>⚠</span>
                  <div>
                    This replaces your call on{' '}
                    <b>{usDay(mySlot.starts_at)} at {usTime(mySlot.starts_at)}</b>.
                  </div>
                </div>
              ) : (
                <p className="sm muted" style={{ marginTop: 12 }}>
                  You will get a confirmation email now and a reminder 24 hours before.
                </p>
              )}
            </div>
            <div className="ft">
              <button className="btn" type="button" onClick={() => setConfirm(null)}>Cancel</button>
              {confirm.booked_by === meId ? (
                <form action={cancelAction}>
                  <input type="hidden" name="booking_id" value={confirm.booking_id ?? ''} />
                  <button className="btn primary" type="submit" onClick={() => setConfirm(null)}>Release</button>
                </form>
              ) : (
                <form action={bookAction}>
                  <input type="hidden" name="slot_id" value={confirm.id} />
                  <button className="btn primary" type="submit">Confirm booking</button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
