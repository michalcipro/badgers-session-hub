'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type NavLink = { href: string; label: string }

/**
 * Which tab is lit comes from the address bar, not from each page
 * remembering to say so — one page forgot, and nothing was ever lit.
 * A child page like /admin/players/[id] lights its parent.
 */
export function Nav({ links }: { links: NavLink[] }) {
  const path = usePathname()

  const current = links
    .filter((l) => path === l.href || path.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]

  return (
    <nav className="nav">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.href === current?.href ? 'page' : undefined}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  )
}
