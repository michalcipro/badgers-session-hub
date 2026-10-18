import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type Role = 'admin' | 'coach' | 'player'
export type Status = 'pending' | 'active' | 'declined' | 'archived'

export type Profile = {
  id: string
  email: string
  first_name: string
  last_name: string
  role: Role
  status: Status
  class_year: string | null
  title: string | null
  /** The one account that cannot be demoted or edited by another admin. */
  is_owner: boolean
  created_at: string
}

export async function currentProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (data as Profile) ?? null
}

/** Use at the top of every signed-in page. */
export async function requireActive(role?: Role): Promise<Profile> {
  const profile = await currentProfile()
  if (!profile) redirect('/login')
  if (profile.status !== 'active') redirect('/pending')
  if (role && profile.role !== role) redirect('/')
  return profile
}

export const fullName = (p: { first_name: string; last_name: string }) =>
  `${p.first_name} ${p.last_name}`.trim()

/** What teammates see of each other: first name and an initial. */
export const shortName = (p: { first_name: string; last_name: string }) =>
  p.last_name ? `${p.first_name} ${p.last_name[0]}.` : p.first_name

export const initials = (p: { first_name: string; last_name: string }) =>
  `${p.first_name[0] ?? '?'}${p.last_name[0] ?? ''}`.toUpperCase()
