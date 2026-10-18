'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type FormState = { error?: string }

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
