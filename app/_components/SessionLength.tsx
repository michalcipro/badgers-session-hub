'use client'

import { useActionState } from 'react'
import { setSessionLength, type AccountResult } from '@/app/admin/actions'
import { SESSION_LENGTHS } from '@/lib/settings'

/**
 * One length for every call, rather than a choice beside every click.
 * Changing it only affects times offered from now on — the ones already
 * in the calendar keep the length they were offered at.
 */
export function SessionLength({ current }: { current: number }) {
  const [state, action, pending] = useActionState<AccountResult, FormData>(setSessionLength, {})

  return (
    <form className="bd" action={action}>
      <label className="fld" style={{ maxWidth: 160 }}>
        Every call lasts
        <select name="session_min" defaultValue={current} disabled={pending}>
          {SESSION_LENGTHS.map((m) => (
            <option key={m} value={m}>{m} minutes</option>
          ))}
        </select>
      </label>

      {state.error && <div className="note bad" style={{ marginTop: 12 }}>{state.error}</div>}
      {state.ok && <div className="note ok" style={{ marginTop: 12 }}>{state.ok}</div>}

      <button className="btn primary" type="submit" disabled={pending} style={{ marginTop: 12 }}>
        {pending ? 'Saving…' : 'Save'}
      </button>
      <p className="xs muted" style={{ marginTop: 8 }}>
        Applies to every time you offer from now on, and to the consultations coaches ask
        for. Times already in the calendar keep the length they were offered at.
      </p>
    </form>
  )
}
