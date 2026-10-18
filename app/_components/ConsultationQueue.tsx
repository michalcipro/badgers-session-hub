'use client'

import { useActionState } from 'react'
import { confirmConsultation, declineConsultation, type ConsultationResult } from '@/app/consultation-actions'
import { czDay, czTime, usDay, usTime } from '@/lib/time'

export type PendingConsultation = {
  id: string
  coachName: string
  requested_at: string
  duration_min: number
  topic: string | null
}

export function ConsultationQueue({ rows }: { rows: PendingConsultation[] }) {
  const [okState, confirmAction, confirming] = useActionState<ConsultationResult, FormData>(confirmConsultation, {})
  const [noState, declineAction] = useActionState<ConsultationResult, FormData>(declineConsultation, {})
  const error = okState.error ?? noState.error

  return (
    <div className="card">
      <div className="hd">
        <h3>Consultation requests</h3>
        <span className="sub">Coaching staff asking for a time of their own</span>
        {rows.length > 0 && <span className="pill warn num">{rows.length} waiting</span>}
      </div>

      {error && <div className="bd" style={{ paddingBottom: 0 }}><div className="note bad">{error}</div></div>}

      {rows.length === 0 ? (
        <div className="bd sm muted">Nothing waiting.</div>
      ) : (
        <div className="list">
          {rows.map((c) => (
            <div className="it" key={c.id} style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <div className="nm">{c.coachName}</div>
                <div className="sm num">
                  {czDay(c.requested_at)} · {czTime(c.requested_at)} Prague
                </div>
                <div className="xs muted num">
                  {usDay(c.requested_at)} {usTime(c.requested_at)} her time · {c.duration_min} min
                </div>
                {c.topic && <div className="xs" style={{ marginTop: 4 }}>{c.topic}</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
                <input
                  type="text"
                  form={`confirm-${c.id}`}
                  name="note"
                  placeholder="Reply, optional…"
                />
                <div className="row" style={{ gap: 6 }}>
                  <form action={confirmAction} id={`confirm-${c.id}`}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="btn primary sm" type="submit" disabled={confirming}>Confirm</button>
                  </form>
                  <form action={declineAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="btn ghost sm" type="submit">Decline</button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
