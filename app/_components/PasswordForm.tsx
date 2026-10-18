'use client'

import { useActionState, useEffect, useRef } from 'react'
import { changePassword, type FormState } from '@/app/actions'

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, {})
  const ref = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok) ref.current?.reset()
  }, [state.ok])

  return (
    <form className="bd" action={action} ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label className="fld">
        Current password
        <input type="password" name="current_password" autoComplete="current-password" required />
      </label>
      <label className="fld">
        New password
        <input type="password" name="new_password" autoComplete="new-password" minLength={8} required />
      </label>
      <label className="fld">
        New password again
        <input type="password" name="confirm_password" autoComplete="new-password" minLength={8} required />
      </label>

      {state.error && <div className="note bad">{state.error}</div>}
      {state.ok && <div className="note ok">{state.ok}</div>}

      <button className="btn primary" type="submit" disabled={pending} style={{ alignSelf: 'flex-start' }}>
        {pending ? 'Changing…' : 'Change password'}
      </button>
      <p className="xs muted">At least 8 characters. Use something you do not use anywhere else.</p>
    </form>
  )
}
