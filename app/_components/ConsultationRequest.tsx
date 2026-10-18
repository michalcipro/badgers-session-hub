'use client'

import { useActionState, useEffect, useRef } from 'react'
import { cancelConsultation, requestConsultation, type ConsultationResult } from '@/app/consultation-actions'
import { czDay, czTime, usDay, usTime } from '@/lib/time'

export type ConsultationRow = {
  id: string
  requested_at: string
  duration_min: number
  topic: string | null
  status: 'requested' | 'confirmed' | 'declined' | 'cancelled'
  note: string | null
  meet_url: string | null
}

const LABEL = {
  requested: { text: 'Waiting for Winning Minds', cls: 'pill warn' },
  confirmed: { text: 'Confirmed', cls: 'pill ok' },
  declined: { text: 'Declined', cls: 'pill accent' },
  cancelled: { text: 'Withdrawn', cls: 'pill plain' },
} as const

export function ConsultationRequest({
  rows,
  lengthMin,
}: {
  rows: ConsultationRow[]
  lengthMin: number
}) {
  const [state, action, pending] = useActionState<ConsultationResult, FormData>(requestConsultation, {})
  const [cancelState, cancelAction] = useActionState<ConsultationResult, FormData>(cancelConsultation, {})
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok) formRef.current?.reset()
  }, [state.ok])

  const now = Date.now()

  return (
    <>
      <div className="card">
        <div className="hd">
          <h3>Ask for a time</h3>
          <span className="sub">Your own time, outside the squares offered to players</span>
        </div>
        <form className="bd" action={action} ref={formRef}>
          <div className="row" style={{ alignItems: 'flex-end', gap: 12 }}>
            <label className="fld" style={{ flex: '1 1 150px' }}>
              Date
              <input type="date" name="date" required />
            </label>
            <label className="fld" style={{ flex: '0 1 130px' }}>
              Time (yours)
              <input type="time" name="time" step={900} required />
            </label>
            <div className="fld" style={{ flex: '0 1 120px' }}>
              Length
              {/* Not a choice: every call is the same length, set by
                  Winning Minds, so a consultation cannot drift from it. */}
              <span className="val num">{lengthMin} minutes</span>
            </div>
          </div>
          <label className="fld" style={{ marginTop: 12 }}>
            What it is about <span className="faint">(optional)</span>
            <textarea name="topic" rows={2} placeholder="So they can prepare…" />
          </label>

          {state.error && <div className="note bad" style={{ marginTop: 12 }}>{state.error}</div>}
          {state.ok && <div className="note ok" style={{ marginTop: 12 }}>{state.ok}</div>}

          <button className="btn primary" type="submit" disabled={pending} style={{ marginTop: 12 }}>
            {pending ? 'Asking…' : 'Ask for this time'}
          </button>
          <p className="xs muted" style={{ marginTop: 8 }}>
            Times are yours in Madison. Nothing is agreed until Michal or Milan confirms it.
          </p>
        </form>
      </div>

      <div className="card">
        <div className="hd">
          <h3>Your consultations</h3>
          <span className="sub">{rows.length} in total</span>
        </div>
        {cancelState.error && (
          <div className="bd" style={{ paddingBottom: 0 }}><div className="note bad">{cancelState.error}</div></div>
        )}
        {rows.length === 0 ? (
          <div className="bd sm muted">You have not asked for a time yet.</div>
        ) : (
          <div className="list">
            {rows.map((c) => {
              const label = LABEL[c.status]
              const past = new Date(c.requested_at).getTime() < now
              return (
                <div className="it" key={c.id}>
                  <div className="grow">
                    <div className="nm num">{usDay(c.requested_at)} · {usTime(c.requested_at)}</div>
                    <div className="xs muted num">
                      {c.duration_min} min · {czDay(c.requested_at)} {czTime(c.requested_at)} in Prague
                    </div>
                    {c.topic && <div className="xs" style={{ marginTop: 3 }}>{c.topic}</div>}
                    {c.note && (
                      <div className="xs" style={{ marginTop: 3, color: 'var(--accent)' }}>
                        Winning Minds: {c.note}
                      </div>
                    )}
                    {c.status === 'confirmed' && c.meet_url && !past && (
                      <a className="xs" href={c.meet_url} target="_blank" rel="noreferrer" style={{ marginTop: 3, display: 'inline-block' }}>
                        Join the call
                      </a>
                    )}
                  </div>
                  <span className={label.cls}>{label.text}</span>
                  {c.status === 'requested' && (
                    <form action={cancelAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="btn ghost sm" type="submit">Withdraw</button>
                    </form>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
