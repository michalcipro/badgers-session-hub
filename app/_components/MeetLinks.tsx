'use client'

import { useActionState } from 'react'
import { czDay, czTime, usTime } from '@/lib/time'
import type { SlotRow } from '@/lib/week'
import { releaseBooking, setMeetUrl, type ActionResult } from '@/app/slot-actions'

export function MeetLinks({ slots }: { slots: SlotRow[] }) {
  const [linkState, linkAction, linkPending] = useActionState<ActionResult, FormData>(setMeetUrl, {})
  const [relState, relAction] = useActionState<ActionResult, FormData>(releaseBooking, {})

  if (slots.length === 0) return null
  const missing = slots.filter((s) => !s.meet_url).length

  return (
    <div className="card">
      <div className="hd">
        <h3>This week&rsquo;s calls</h3>
        {missing > 0 && (
          <span className="pill warn">
            {missing} without a link
          </span>
        )}
        <form action={linkAction} className="row" style={{ marginLeft: 'auto', gap: 8 }}>
          <input type="hidden" name="ids" value={slots.map((s) => s.id).join(',')} />
          <input
            type="text"
            name="meet_url"
            placeholder="One Meet link for the whole week…"
            style={{ maxWidth: 250 }}
          />
          <button className="btn sm" type="submit" disabled={linkPending}>
            {linkPending ? 'Saving…' : 'Apply to all'}
          </button>
        </form>
      </div>

      {(linkState.error || relState.error) && (
        <div className="bd" style={{ paddingBottom: 0 }}>
          <div className="note bad">{linkState.error ?? relState.error}</div>
        </div>
      )}
      {linkState.ok && (
        <div className="bd" style={{ paddingBottom: 0 }}>
          <div className="note ok">{linkState.ok}</div>
        </div>
      )}

      <div className="list">
        {slots.map((s) => (
          <div className="it" key={s.id}>
            <div style={{ minWidth: 150 }}>
              <div className="nm num">{czDay(s.starts_at)} · {czTime(s.starts_at)}</div>
              <div className="xs muted num">{usTime(s.starts_at)} Madison · {s.duration_min} min</div>
            </div>
            <div className="grow">
              {s.booked_name
                ? <span className="pill accent">{s.booked_name}</span>
                : <span className="pill plain">Open</span>}
              {s.meet_url
                ? <div className="xs muted trunc" style={{ marginTop: 4, maxWidth: 300 }}>{s.meet_url}</div>
                : <div className="xs" style={{ marginTop: 4, color: 'var(--warn)' }}>No Meet link yet</div>}
            </div>
            {s.booking_id && (
              <form action={relAction}>
                <input type="hidden" name="booking_id" value={s.booking_id} />
                <button className="btn ghost sm" type="submit">Release</button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
