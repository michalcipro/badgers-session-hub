'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireActive, type Role } from '@/lib/auth'

const ROLES: Role[] = ['admin', 'coach', 'player']

export async function approveAccount(fd: FormData) {
  await requireActive('admin')

  const id = String(fd.get('id') ?? '')
  const role = String(fd.get('role') ?? 'player') as Role
  if (!id || !ROLES.includes(role)) return

  const supabase = await createClient()
  await supabase.from('profiles').update({ status: 'active', role }).eq('id', id)

  // TODO (next step): email the person that they can sign in now.
  revalidatePath('/admin')
}

export async function declineAccount(fd: FormData) {
  await requireActive('admin')

  const id = String(fd.get('id') ?? '')
  if (!id) return

  const supabase = await createClient()
  await supabase.from('profiles').update({ status: 'declined' }).eq('id', id)

  revalidatePath('/admin')
}
