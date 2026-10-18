'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * `values` carries what was typed back to the form. React resets an
 * uncontrolled form once its action finishes, so without this a failed
 * sign-up would wipe all four fields and make people start again.
 */
export type FormState = {
  error?: string
  ok?: string
  values?: Record<string, string>
}

export async function signUp(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get('email') ?? '').trim()
  const password = String(fd.get('password') ?? '')
  const first_name = String(fd.get('first_name') ?? '').trim()
  const last_name = String(fd.get('last_name') ?? '').trim()

  const values = { first_name, last_name, email }
  if (!email || !password) return { error: 'Enter your email and a password.', values }
  if (password.length < 8) return { error: 'Use at least 8 characters for your password.', values }
  if (!first_name || !last_name) return { error: 'Enter your first and last name.', values }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { first_name, last_name } },
  })
  if (error) {
    // Supabase's built-in mailer is heavily rate limited, and that message
    // means nothing to the person signing up.
    const message = /rate limit/i.test(error.message)
      ? 'Too many sign-ups at once. Wait a few minutes and try again, or ask Winning Minds to add you.'
      : error.message
    return { error: message, values }
  }

  redirect('/pending')
}

export async function signIn(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get('email') ?? '').trim()
  const password = String(fd.get('password') ?? '')
  if (!email || !password) return { error: 'Enter your email and password.', values: { email } }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return { error: 'That email and password do not match an account.', values: { email } }
  }

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
