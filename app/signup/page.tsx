'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { signUp, type FormState } from '@/app/actions'

export default function SignUpPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(signUp, {})

  return (
    <div className="auth wrap">
      <div className="auth-box">
        <div className="mark">
          <div className="dot">W</div>
          <div>
            <h1>Session Hub</h1>
            <span>Winning Minds × Wisconsin Badgers Tennis</span>
          </div>
        </div>

        <div className="card">
          <div className="bd">
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Create your account</h2>
            <p className="sm muted" style={{ marginBottom: 14 }}>
              Winning Minds approves every account before it can be used.
            </p>
            <form action={action}>
              <div className="row" style={{ gap: 12, flexWrap: 'nowrap' }}>
                <label className="fld" style={{ flex: 1, minWidth: 0 }}>
                  First name
                  <input type="text" name="first_name" autoComplete="given-name" required />
                </label>
                <label className="fld" style={{ flex: 1, minWidth: 0 }}>
                  Last name
                  <input type="text" name="last_name" autoComplete="family-name" required />
                </label>
              </div>
              <label className="fld">
                Email
                <input type="email" name="email" autoComplete="email" required />
              </label>
              <label className="fld">
                Password
                <input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
              {state.error && <div className="note bad">{state.error}</div>}
              <button className="btn primary" type="submit" disabled={pending}>
                {pending ? 'Creating…' : 'Create account'}
              </button>
            </form>
          </div>
        </div>

        <p className="auth-foot">
          Already have one? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
