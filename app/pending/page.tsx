import { redirect } from 'next/navigation'
import { signOut } from '@/app/actions'
import { currentProfile } from '@/lib/auth'

export default async function PendingPage() {
  const profile = await currentProfile()
  if (!profile) redirect('/login')
  if (profile.status === 'active') redirect('/')

  const declined = profile.status === 'declined'

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
          <div className="bd" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className={declined ? 'pill accent' : 'pill warn'} style={{ alignSelf: 'flex-start' }}>
              {declined ? 'Not approved' : 'Waiting for approval'}
            </span>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>
              {declined ? 'This account was not approved' : `Thanks, ${profile.first_name}.`}
            </h2>
            <p className="sm muted">
              {declined
                ? 'If you think that is a mistake, talk to your coach or to Winning Minds.'
                : 'Your account is with Winning Minds. Once they approve it you can book your calls and message them here. You will get an email when that happens.'}
            </p>
            <p className="xs faint">Signed in as {profile.email}</p>
            <form action={signOut}>
              <button className="btn" type="submit">Sign out</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
