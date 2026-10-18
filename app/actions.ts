'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type FormState = { error?: string; ok?: string }

export async function signUp(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get('email') ?? '').trim()
  const password = String(fd.get('password') ?? '')
  const first_name = String(fd.get('first_name') ?? '').trim()
  const last_name = String(fd.get('last_name') ?? '').trim()

  if (!email || !password) return { error: 'Enter your email and a password.' }
  if (password.length < 8) return { error: 'Use at least 8 characters for your password.' }
  if (!first_name || !last_name) return { error: 'Enter your first and last name.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { first_name, last_name } },
  })
  if (error) return { error: error.message }

  redirect('/pending')
}

export async function signIn(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get('email') ?? '').trim()
  const password = String(fd.get('password') ?? '')
  if (!email || !password) return { error: 'Enter your email and password.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: 'That email and password do not match an account.' }

  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

/**
 * The project requires a recent sign-in and the current password before a
 * password changes, so this signs in with the old one first. That both
 * proves it is really them and refreshes the session, which is what those
 * two settings ask for.
 */
export async function changePassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const current = String(fd.get('current_password') ?? '')
  const next = String(fd.get('new_password') ?? '')
  const again = String(fd.get('confirm_password') ?? '')

  if (!current || !next) return { error: 'Fill in both your current and your new password.' }
  if (next.length < 8) return { error: 'Use at least 8 characters for the new password.' }
  if (next !== again) return { error: 'The two new passwords do not match.' }
  if (next === current) return { error: 'That is already your password.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'You are not signed in.' }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current,
  })
  if (signInError) return { error: 'Your current password is not right.' }

  const { error } = await supabase.auth.updateUser({ password: next })
  if (error) return { error: error.message }

  return { ok: 'Your password has been changed.' }
}
