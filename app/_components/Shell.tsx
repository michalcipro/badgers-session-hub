import Link from 'next/link'
import { signOut } from '@/app/actions'
import { initials, fullName, type Profile } from '@/lib/auth'

const ROLE_LABEL: Record<Profile['role'], string> = {
  admin: 'Winning Minds',
  coach: 'Coach',
  player: 'Player',
}

const LINKS: Record<Profile['role'], { href: string; label: string }[]> = {
  admin: [
    { href: '/admin', label: 'Today' },
    { href: '/admin/schedule', label: 'Availability' },
    { href: '/admin/players', label: 'Players' },
    { href: '/admin/messages', label: 'Messages' },
    { href: '/admin/files', label: 'Library' },
    { href: '/admin/stats', label: 'Stats' },
    { href: '/account', label: 'Account' },
  ],
  coach: [
    { href: '/coach', label: 'Team' },
    { href: '/coach/consultations', label: 'Consultations' },
    { href: '/messages', label: 'Messages' },
    { href: '/files', label: 'Resources' },
    { href: '/account', label: 'Account' },
  ],
  player: [
    { href: '/player', label: 'My calls' },
    { href: '/messages', label: 'Messages' },
    { href: '/tasks', label: 'Tasks' },
    { href: '/files', label: 'Resources' },
    { href: '/account', label: 'Account' },
  ],
}

export function Shell({
  profile,
  current,
  children,
}: {
  profile: Profile
  current?: string
  children: React.ReactNode
}) {
  const links = LINKS[profile.role]
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
        {links.length > 1 && (
          <div className="top-in wrap" style={{ paddingTop: 0, paddingBottom: 10 }}>
            <nav className="nav">
              {links.map((l) => (
                <Link key={l.href} href={l.href} aria-current={current === l.href ? 'page' : undefined}>
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>
      <main className="page wrap">{children}</main>
    </>
  )
}
