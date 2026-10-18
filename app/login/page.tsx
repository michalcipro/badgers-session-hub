'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { signIn, type FormState } from '@/app/actions'

export default function LoginPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {})

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
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Sign in</h2>
            <form action={action}>
              <label className="fld">
                Email
                <input type="email" name="email" autoComplete="email" required />
              </label>
              <label className="fld">
                Password
                <input type="password" name="password" autoComplete="current-password" required />
              </label>
              {state.error && <div className="note bad">{state.error}</div>}
              <button className="btn primary" type="submit" disabled={pending}>
                {pending ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>

        <p className="auth-foot">
          No account yet? <Link href="/signup">Create one</Link>
        </p>
      </div>
    </div>
  )
}
