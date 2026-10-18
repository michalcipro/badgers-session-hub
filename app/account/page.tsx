import { Shell } from '@/app/_components/Shell'
import { PasswordForm } from '@/app/_components/PasswordForm'
import { SessionLength } from '@/app/_components/SessionLength'
import { createClient } from '@/lib/supabase/server'
import { requireActive, fullName } from '@/lib/auth'
import { sessionMin } from '@/lib/settings'

const ROLE_TEXT = {
  admin: 'Winning Minds',
  coach: 'Coach',
  player: 'Player',
} as const

export default async function AccountPage() {
  const me = await requireActive()

  return (
    <Shell profile={me}>
      <div className="page-h">
        <h2>Your account</h2>
        <p>{fullName(me)} · {ROLE_TEXT[me.role]}{me.is_owner ? ' · owner' : ''}</p>
      </div>

      {me.role === 'admin' && (
        <div className="card" style={{ maxWidth: 420 }}>
          <div className="hd">
            <h3>Session length</h3>
            <span className="sub">For the whole squad</span>
          </div>
          <SessionLength current={await sessionMin(await createClient())} />
        </div>
      )}

      <div className="card" style={{ maxWidth: 420 }}>
        <div className="hd"><h3>Change your password</h3></div>
        <PasswordForm />
      </div>

      <div className="card" style={{ maxWidth: 420 }}>
        <div className="hd"><h3>Sign-in email</h3></div>
        <div className="bd">
          <p className="sm num">{me.email}</p>
          <p className="xs muted" style={{ marginTop: 6 }}>
            Ask Winning Minds if this needs to change.
          </p>
        </div>
      </div>
    </Shell>
  )
}
