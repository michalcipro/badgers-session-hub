'use client'

import { useActionState } from 'react'
import { setAttendance, type ActionResult } from '@/app/slot-actions'

/** Came, did not come, or not marked yet. Every number elsewhere rests on this. */
export function Attendance({
  bookingId,
  attended,
}: {
  bookingId: string
  attended: boolean | null
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(setAttendance, {})

  const button = (value: 'true' | 'false' | 'clear', label: string, active: boolean, cls: string) => (
    <form action={action}>
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="attended" value={value} />
      <button
        type="submit"
        disabled={pending}
        className={active ? `pill ${cls}` : 'btn ghost sm'}
        style={active ? { border: 0, cursor: 'pointer', padding: '4px 10px' } : undefined}
      >
        {label}
      </button>
    </form>
  )

  return (
    <div className="row" style={{ gap: 4 }} title={state.error ?? undefined}>
      {attended === true
        ? button('clear', 'Came', true, 'ok')
        : button('true', 'Came', false, '')}
      {attended === false
        ? button('clear', 'No-show', true, 'warn')
        : button('false', 'No-show', false, '')}
    </div>
  )
}
