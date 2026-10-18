'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import {
  addDays, calFmt, czTime, dayKey, gapHours, hourLabel, minuteLabel,
  minutesInDay, mondayOf, timeIn, usDay, usTime, ymd, type CalDate,
} from '@/lib/time'
import type { SlotRow } from '@/lib/week'
import { LANES } from '@/lib/lanes'
import {
  bookSlot, cancelBooking, createSlot, deleteSlot,
  type ActionResult,
} from '@/app/slot-actions'

const STEP = 15            // minutes per click target
const HOUR_H = 64          // pixels per hour, for the grid and the labels alike
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
  /** How long a call is. One setting, not a choice at every click. */
  lengthMin: number
}

/** Anything the grid has to find room for: a single time, or a group of them. */
type Span = { id: string; starts_at: string; duration_min: number }

/**
 * Winning Minds is two people, so the same time can hold two calls. To a
 * player those are not two different things to choose between — they are
 * two places at one time, and which of the two coaches she gets is their
 * business, not hers. So her grid shows one block per time and says how
 * many places are left in it.
 */
type Group = Span & { slots: SlotRow[] }

function groupByTime(day: SlotRow[]): Group[] {
  const by = new Map<string, Group>()
  for (const s of day) {
    // Same start and same length, or they are not interchangeable.
    const key = `${s.starts_at}|${s.duration_min}|${s.kind}`
    const g = by.get(key)
    if (g) g.slots.push(s)
    else by.set(key, { id: key, starts_at: s.starts_at, duration_min: s.duration_min, slots: [s] })
  }
  return [...by.values()]
}

/** Two places, one taken: ● ○. Only drawn when there is more than one. */
function Pips({ total, taken }: { total: number; taken: number }) {
  if (total < 2) return null
  return (
    <span className="pips" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < taken ? 'on' : undefined} />
      ))}
    </span>
  )
}

/** What the confirmation dialog is about: one place, in a time of so many. */
type Pick = { slot: SlotRow; places: number; otherName: string | null }

export function WeekCalendar(props: Props) {
  const { mode, tz, weekStart, basePath, slots, hours, meId, nowISO, lengthMin } = props
  const [startH, endH] = hours
  const rows = endH - startH
  const now = new Date(nowISO).getTime()

  const [confirm, setConfirm] = useState<Pick | null>(null)

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
  // Named explicitly, because without ?week= the page may well have
  // opened somewhere else on purpose.
  const thisWeek = dayKey(mondayOf(ymd(nowISO, tz)))
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

  /**
   * Times that overlap are laid out side by side, the way a calendar does
   * it: each cluster of overlapping blocks is split into as many columns
   * as it needs.
   */
  function placed(day: Span[]) {
    const sorted = [...day].sort((a, b) =>
      a.starts_at < b.starts_at ? -1 : a.starts_at > b.starts_at ? 1 : a.duration_min - b.duration_min
    )
    const out = new Map<string, { col: number; cols: number }>()

    let cluster: Span[] = []
    let clusterEnd = -Infinity

    const flush = () => {
      if (cluster.length === 0) return
      const colEnds: number[] = []
      const cols = new Map<string, number>()
      for (const s of cluster) {
        const start = +new Date(s.starts_at)
        const end = start + s.duration_min * 60_000
        let col = colEnds.findIndex((e) => e <= start)
        if (col === -1) { col = colEnds.length; colEnds.push(end) } else colEnds[col] = end
        cols.set(s.id, col)
      }
      for (const s of cluster) out.set(s.id, { col: cols.get(s.id) ?? 0, cols: colEnds.length })
      cluster = []
      clusterEnd = -Infinity
    }

    for (const s of sorted) {
      const start = +new Date(s.starts_at)
      const end = start + s.duration_min * 60_000
      if (cluster.length > 0 && start >= clusterEnd) flush()
      cluster.push(s)
      clusterEnd = Math.max(clusterEnd, end)
    }
    flush()
    return out
  }

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

  const box = (p: { col: number; cols: number }, iso: string, min: number) => {
    const span = 100 / p.cols
    return {
      top: top(iso),
      height: height(min),
      left: `calc(${p.col * span}% + 2px)`,
      width: `calc(${span}% - 4px)`,
      right: 'auto' as const,
    }
  }

  const bothZones = (iso: string) => `${czTime(iso)} Prague · ${usTime(iso)} Madison`

  // ------------------------------------------------- what each side draws

  /**
   * Winning Minds sees the two lanes as they are: a day is two columns,
   * one for each of them, and a call sits in the column it was offered
   * in. The other column stays empty and clickable whatever happens in
   * this one, so the second of them is always one click away.
   */
  function adminBlock(s: SlotRow) {
    const style = box({ col: s.lane - 1, cols: LANES }, s.starts_at, s.duration_min)
    const past = new Date(s.starts_at).getTime() <= now
    const h = height(s.duration_min)
    const who = s.booked_name ?? (past ? 'Not used' : 'Free')
    const body =
      h < COMPACT_H ? (
        <span className="t one">{timeIn(s.starts_at, tz)} · {who}</span>
      ) : (
        <>
          <span className="t">{timeIn(s.starts_at, tz)}</span>
          <span className="n">
            {s.booked_name ?? (past ? 'Not used' : `Free · ${s.duration_min} min`)}
          </span>
        </>
      )

    if (s.kind === 'consultation') {
      return (
        <div key={s.id} className={`cal-ev ${past ? 'past' : 'consult'}`} style={style}
          title={bothZones(s.starts_at)}>
          {body}
        </div>
      )
    }

    if (!s.booking_id && !past) {
      return (
        <form action={delAction} key={s.id}>
          <input type="hidden" name="id" value={s.id} />
          <button type="submit" className="cal-ev free can" style={style}
            title={`${bothZones(s.starts_at)} — click to withdraw`}>
            {body}
          </button>
        </form>
      )
    }

    return (
      <div key={s.id} className={`cal-ev ${past ? 'past' : s.booking_id ? 'taken' : 'free'}`}
        style={style} title={bothZones(s.starts_at)}>
        {body}
      </div>
    )
  }

  /** What a time amounts to for this player, read once and used twice. */
  function readGroup(g: Group) {
    const past = new Date(g.starts_at).getTime() <= now
    const total = g.slots.length
    const taken = g.slots.filter((s) => s.booking_id)
    const free = g.slots.filter((s) => !s.booking_id)
    const mineHere = g.slots.find((s) => s.booked_by === meId)
    const others = taken
      .filter((s) => s.booked_by !== meId)
      .map((s) => s.booked_name)
      .filter((n): n is string => Boolean(n))

    const title =
      `${czTime(g.starts_at)} in Prague` +
      (total > 1 ? ` · ${free.length} of ${total} places free` : '') +
      (others.length > 0 ? ` · ${others.join(', ')}` : '')

    const open = () => {
      if (past) return
      if (mineHere) setConfirm({ slot: mineHere, places: total, otherName: others[0] ?? null })
      else if (free.length > 0) {
        setConfirm({ slot: free[0], places: total, otherName: others[0] ?? null })
      }
    }

    return { past, total, taken, free, mineHere, others, title, open }
  }

  /** A player sees one block per time, and how many places are in it. */
  function playerBlock(g: Group, p: { col: number; cols: number }) {
    const style = box(p, g.starts_at, g.duration_min)
    const h = height(g.duration_min)
    const { past, total, taken, free, mineHere, others, title, open } = readGroup(g)

    const long = mineHere
      ? 'Your call'
      : past
        ? taken.length > 0 ? others.join(' · ') : 'Not used'
        : free.length === total
          ? total > 1 ? `${total} places` : `Free · ${g.duration_min} min`
          : free.length > 0
            ? `${free.length} of ${total} left`
            : others.join(' · ')

    const pips = <Pips total={total} taken={taken.length} />
    const body =
      h < COMPACT_H ? (
        // At this height the dots say what the words would, and words
        // that do not fit wrap into nonsense.
        <span className="t one">
          {timeIn(g.starts_at, tz)}{mineHere ? ' · Yours' : ''} {pips}
        </span>
      ) : (
        <>
          <span className="t">{timeIn(g.starts_at, tz)} {pips}</span>
          <span className="n">{long}</span>
        </>
      )

    if (past) {
      return (
        <div key={g.id} className="cal-ev past" style={style} title={title}>{body}</div>
      )
    }

    if (mineHere) {
      return (
        <button key={g.id} type="button" className="cal-ev mine" style={style} title={title}
          onClick={open}>
          {body}
        </button>
      )
    }

    if (free.length > 0) {
      return (
        <button
          key={g.id}
          type="button"
          className={`cal-ev free can${total > 1 ? ' pair' : ''}`}
          style={style}
          title={title}
          onClick={open}
        >
          {body}
        </button>
      )
    }

    return (
      <div key={g.id} className={`cal-ev taken${total > 1 ? ' pair' : ''}`} style={style} title={title}>
        {body}
      </div>
    )
  }

  /**
   * The same week as a list, for a phone. A seven-column grid on a 375px
   * screen shows three and a half days and hides the rest behind a
   * sideways scroll inside a page that already scrolls down — so the
   * days go under each other and the times become things to tap.
   */
  function phoneList() {
    const rows = days
      .map((d) => ({ d, groups: groupByTime(slotsOn(d)) }))
      .filter((x) => x.groups.length > 0)

    if (rows.length === 0) {
      return (
        <div className="cal-days">
          <p className="bd sm muted">Nothing offered this week. Try the arrows above.</p>
        </div>
      )
    }

    return (
      <div className="cal-days">
        {rows.map(({ d, groups }) => (
          <div className="day" key={dayKey(d)}>
            <div className="dh">
              <span className="dw">{calFmt(d, { weekday: 'long' })}</span>
              <span className="dd num">{calFmt(d, { month: 'short', day: 'numeric' })}</span>
            </div>
            <div className="times">
              {groups.map((g) => {
                const { past, total, taken, free, mineHere, title, open } = readGroup(g)
                const cls = past ? 'past' : mineHere ? 'mine' : free.length > 0 ? 'free' : 'taken'
                const canTap = !past && (Boolean(mineHere) || free.length > 0)
                const inner = (
                  <>
                    <span className="num">{timeIn(g.starts_at, tz)}</span>
                    {mineHere ? <span className="w">Yours</span> : null}
                    <Pips total={total} taken={taken.length} />
                  </>
                )
                return canTap ? (
                  <button key={g.id} type="button" className={`slot ${cls}`} title={title} onClick={open}>
                    {inner}
                  </button>
                ) : (
                  <div key={g.id} className={`slot ${cls}`} title={title}>{inner}</div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const release = confirm?.slot.booked_by === meId

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
            {dayKey(weekStart) !== thisWeek && (
              <Link className="btn ghost sm" href={`${basePath}?week=${thisWeek}`}>This week</Link>
            )}
          </div>
          <span className="sub num">
            {mode === 'admin'
              ? `${slots.length} time${slots.length === 1 ? '' : 's'} · ${slots.filter(s => s.booking_id).length} booked`
              : `${freeCount} open place${freeCount === 1 ? '' : 's'} this week`}
          </span>
          {mode === 'admin' && (
            <span className="sub num" style={{ marginLeft: 'auto' }}>
              {lengthMin} min each · <Link href="/account">change</Link>
            </span>
          )}
        </div>

        {mode === 'player' && phoneList()}

        <div className={`calwrap${mode === 'player' ? ' wide-only' : ''}`}>
          {/* The hour labels are laid out by CSS and the blocks by this
              component, so the row height has to come from one place or
              they drift apart an hour at a time. */}
          <div className="cal" style={{ '--hh': `${HOUR_H}px` } as React.CSSProperties}>
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
              const groups = mode === 'admin' ? [] : groupByTime(mine)
              const place = placed(groups)
              const at = (id: string) => place.get(id) ?? { col: 0, cols: 1 }

              return (
                <div className={`cal-col${mode === 'admin' ? ' lanes' : ''}`} key={dk}
                  style={{ height: rows * HOUR_H }}>
                  {Array.from({ length: rows }, (_, i) => (
                    <div key={`h${i}`} className="hr" style={{ top: i * HOUR_H }} />
                  ))}
                  {Array.from({ length: rows }, (_, i) => (
                    <div key={`hh${i}`} className="hr half" style={{ top: i * HOUR_H + HOUR_H / 2 }} />
                  ))}

                  {mode === 'admin' &&
                    Array.from({ length: (rows * 60) / STEP }, (_, i) => {
                      const minute = startH * 60 + i * STEP
                      const when = `${calFmt(d, { weekday: 'long', month: 'long', day: 'numeric' })} at ${minuteLabel(minute, tz)}`
                      return Array.from({ length: LANES }, (_, l) => (
                        <form action={addAction} key={`a${i}-${l}`}>
                          <input type="hidden" name="date" value={dk} />
                          <input type="hidden" name="minute" value={minute} />
                          <input type="hidden" name="lane" value={l + 1} />
                          <button
                            type="submit"
                            className="cal-add"
                            style={{
                              top: (i * STEP * HOUR_H) / 60,
                              height: (STEP * HOUR_H) / 60,
                              left: `calc(${(l * 100) / LANES}% + 1px)`,
                              width: `calc(${100 / LANES}% - 2px)`,
                              right: 'auto',
                            }}
                            aria-label={`Offer ${when}, column ${l + 1} of ${LANES}`}
                          />
                        </form>
                      ))
                    })}

                  {mode === 'admin'
                    ? mine.map((s) => adminBlock(s))
                    : groups.map((g) => playerBlock(g, at(g.id)))}
                </div>
              )
            })}
          </div>
        </div>

        <div className="bd" style={{ borderTop: '1px solid var(--line)' }}>
          <p className="xs muted">
            {mode === 'admin'
              ? 'Rows are your own Prague time. Click an empty square to offer it, click a green one to withdraw it. Players only ever see the green squares.'
              : 'Times are yours in Madison, and the Prague time is on the confirmation. Tap a green one to take it — you confirm once and you are booked. Two dots mean two of us run calls then, so two of you can have the same time. Teammates see only each other’s names.'}
          </p>
        </div>
      </div>

      {confirm && (
        <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) setConfirm(null) }}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="mb">
              <div className="eyebrow">{release ? 'Release this time?' : 'Confirm your call'}</div>
              <div className="big">
                {calFmt(
                  {
                    y: +new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric' }).format(new Date(confirm.slot.starts_at)),
                    m: +new Intl.DateTimeFormat('en-GB', { timeZone: tz, month: '2-digit' }).format(new Date(confirm.slot.starts_at)),
                    d: +new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: '2-digit' }).format(new Date(confirm.slot.starts_at)),
                  },
                  { weekday: 'long', month: 'short', day: 'numeric' }
                )}{' '}
                · {usTime(confirm.slot.starts_at)}
              </div>
              <p className="sm muted num" style={{ marginTop: 5 }}>
                {confirm.slot.duration_min} minutes · {czTime(confirm.slot.starts_at)} in Prague
              </p>

              {confirm.places > 1 && !release && (
                <div className="note ok" style={{ marginTop: 14 }}>
                  <Pips total={confirm.places} taken={confirm.otherName ? 1 : 0} />
                  <div>
                    Two of us run calls at this time, so it holds {confirm.places} places. You are
                    taking one{confirm.otherName
                      ? `, and ${confirm.otherName} has the other.`
                      : ' — a teammate can still take the other.'}
                  </div>
                </div>
              )}

              {release ? (
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
              {release ? (
                <form action={cancelAction}>
                  <input type="hidden" name="booking_id" value={confirm.slot.booking_id ?? ''} />
                  <button className="btn primary" type="submit" onClick={() => setConfirm(null)}>Release</button>
                </form>
              ) : (
                <form action={bookAction}>
                  <input type="hidden" name="slot_id" value={confirm.slot.id} />
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
