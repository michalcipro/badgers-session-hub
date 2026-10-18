import { redirect } from 'next/navigation'
import { currentProfile } from '@/lib/auth'

const HOME = { admin: '/admin', coach: '/coach', player: '/player' } as const

export default async function Index() {
  const profile = await currentProfile()
  if (!profile) redirect('/login')
  if (profile.status !== 'active') redirect('/pending')
  redirect(HOME[profile.role])
}
