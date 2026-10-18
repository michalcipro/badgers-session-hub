import { signOut } from '@/app/actions'
import { createClient } from '@/lib/supabase/server'
import { loadBadges } from '@/lib/badges'
import { Brand } from './Brand'
import { Nav } from './Nav'
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

export async function Shell({
  profile,
  children,
}: {
  profile: Profile
  children: React.ReactNode
}) {
  const links = LINKS[profile.role]
  const badges = await loadBadges(await createClient(), profile)
  return (
    <>
      <header className="top">
        <div className="top-in wrap">
          <Brand href={links[0]?.href ?? '/'} />
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
            <Nav links={links} badges={badges} />
          </div>
        )}
      </header>
      <main className="page wrap">{children}</main>
    </>
  )
}
