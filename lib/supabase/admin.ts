import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Bypasses row-level security. Only the reminder cron uses it, because it
 * runs as nobody and still has to read every booking due tomorrow.
 *
 * Never import this from anything a browser can reach.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
