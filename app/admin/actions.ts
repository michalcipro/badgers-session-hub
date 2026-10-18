'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireActive, type Role } from '@/lib/auth'

export type AccountResult = { error?: string; ok?: string }

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

/**
 * Guards shared by every action that touches somebody else's account.
 * The owner is untouchable, and only the owner may act on another admin.
 */
async function targetOrRefusal(id: string) {
  const me = await requireActive('admin')
  if (!id) return { error: 'Missing account.' as const }
  if (id === me.id) return { error: 'You cannot do that to your own account.' as const }

  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role, is_owner')
    .eq('id', id)
    .maybeSingle()

  if (!data) return { error: 'That account no longer exists.' as const }
  if (data.is_owner) return { error: 'The owner account cannot be changed here.' as const }
  if (data.role === 'admin' && !me.is_owner) {
    return { error: 'Only the owner can act on another Winning Minds account.' as const }
  }
  return { target: data, supabase }
}

/** Takes away access but keeps her notes, tasks and attendance record. */
export async function archiveAccount(_p: AccountResult, fd: FormData): Promise<AccountResult> {
  const got = await targetOrRefusal(String(fd.get('id') ?? ''))
  if ('error' in got) return got

  const { error } = await got.supabase
    .from('profiles')
    .update({ status: 'archived' })
    .eq('id', got.target.id)
  if (error) return { error: error.message }

  revalidatePath('/admin/players')
  revalidatePath('/admin')
  return { ok: `${got.target.first_name} can no longer sign in. Her record is kept.` }
}

export async function restoreAccount(_p: AccountResult, fd: FormData): Promise<AccountResult> {
  const got = await targetOrRefusal(String(fd.get('id') ?? ''))
  if ('error' in got) return got

  const { error } = await got.supabase
    .from('profiles')
    .update({ status: 'active' })
    .eq('id', got.target.id)
  if (error) return { error: error.message }

  revalidatePath('/admin/players')
  return { ok: `${got.target.first_name} is back on the squad.` }
}

/**
 * Erases the account and everything attached to it: bookings, tasks,
 * messages, files meant for her, and the session notes about her. There is
 * no undo, so the UI asks twice.
 */
export async function deleteAccount(_p: AccountResult, fd: FormData): Promise<AccountResult> {
  const got = await targetOrRefusal(String(fd.get('id') ?? ''))
  if ('error' in got) return got

  if (String(fd.get('confirm') ?? '') !== 'DELETE') {
    return { error: 'Not confirmed.' }
  }

  const { error } = await createAdminClient().auth.admin.deleteUser(got.target.id)
  if (error) return { error: error.message }

  revalidatePath('/admin/players')
  revalidatePath('/admin')
  redirect('/admin/players')
}

export async function declineAccount(fd: FormData) {
  await requireActive('admin')

  const id = String(fd.get('id') ?? '')
  if (!id) return

  const supabase = await createClient()
  await supabase.from('profiles').update({ status: 'declined' }).eq('id', id)

  revalidatePath('/admin')
}
