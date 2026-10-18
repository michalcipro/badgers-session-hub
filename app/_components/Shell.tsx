import { signOut } from '@/app/actions'
import { initials, fullName, type Profile } from '@/lib/auth'

const ROLE_LABEL: Record<Profile['role'], string> = {
  admin: 'Winning Minds',
  coach: 'Coach',
  player: 'Player',
}

export function Shell({
  profile,
  children,
}: {
  profile: Profile
  children: React.ReactNode
}) {
  return (
    <>
      <header className="top">
        <div className="top-in wrap">
          <div className="mark">
            <div className="dot">W</div>
            <div>
              <h1>Session Hub</h1>
              <span>Winning Minds × Wisconsin Badgers Tennis</span>
            </div>
          </div>
          <div className="who">
            <span className="trunc">
              {fullName(profile)} · {ROLE_LABEL[profile.role]}
            </span>
            <div className="avatar">{initials(profile)}</div>
            <form action={signOut}>
              <button className="btn ghost sm" type="submit">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="page wrap">{children}</main>
    </>
  )
}
