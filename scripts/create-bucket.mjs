/**
 * Creates the private storage bucket the app keeps session materials in.
 *
 *   npm run setup:storage
 *
 * Hosted Supabase ignores an insert into storage.buckets from the SQL
 * editor, so this goes through the API instead. Safe to run twice.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'session-files'

const env = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { data, error } = await supabase.storage.listBuckets()
if (error) {
  console.error(`  ✕ could not reach storage: ${error.message}`)
  process.exit(1)
}

if (data.some((b) => b.id === BUCKET)) {
  console.log(`  ✓ bucket "${BUCKET}" already exists`)
  process.exit(0)
}

const { error: createError } = await supabase.storage.createBucket(BUCKET, {
  public: false,
  fileSizeLimit: 25 * 1024 * 1024,
})

if (createError) {
  console.error(`  ✕ could not create the bucket: ${createError.message}`)
  process.exit(1)
}

console.log(`  ✓ private bucket "${BUCKET}" created`)
