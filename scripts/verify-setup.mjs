/**
 * Checks a freshly migrated Supabase project.
 *
 *   node scripts/verify-setup.mjs
 *
 * Creates two throwaway accounts, signs in as each, and tries the things
 * they should and should not be able to do. Everything it makes is deleted
 * again at the end, including when a check fails.
 *
 * Reads .env.local. Nothing is printed except pass/fail lines — no keys.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// ------------------------------------------------------------------ setup

function loadEnv(path = '.env.local') {
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    die(`${path} not found. Copy .env.example to .env.local and fill it in.`)
  }
  const env = {}
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

function die(msg) {
  console.error(`\n  ✕ ${msg}\n`)
  process.exit(1)
}

const env = loadEnv()
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY

if (!URL || !ANON) die('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.')
if (!SERVICE) die('SUPABASE_SERVICE_ROLE_KEY must be set for this check.')

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const anonClient = () => createClient(URL, ANON, { auth: { persistSession: false } })

// ------------------------------------------------------------------ runner

let passed = 0
let failed = 0

async function check(name, fn) {
  try {
    const problem = await fn()
    if (problem) {
      failed++
      console.log(`  ✕ ${name}\n      ${problem}`)
    } else {
      passed++
      console.log(`  ✓ ${name}`)
    }
  } catch (err) {
    failed++
    console.log(`  ✕ ${name}\n      threw: ${err.message}`)
  }
}

const stamp = Date.now()
const made = { users: [], slots: [] }

const PEOPLE = {
  admin: { email: `verify-admin-${stamp}@example.com`, password: `Vf!${stamp}aA`, role: 'admin' },
  player: { email: `verify-player-${stamp}@example.com`, password: `Vf!${stamp}bB`, role: 'player' },
  other: { email: `verify-other-${stamp}@example.com`, password: `Vf!${stamp}cC`, role: 'player' },
}

async function createPerson(p, first, last) {
  const { data, error } = await admin.auth.admin.createUser({
    email: p.email,
    password: p.password,
    email_confirm: true,
    user_metadata: { first_name: first, last_name: last },
  })
  if (error) die(`could not create a test account: ${error.message}`)
  made.users.push(data.user.id)

  const { error: upErr } = await admin
    .from('profiles')
    .update({ status: 'active', role: p.role })
    .eq('id', data.user.id)
  if (upErr) die(`the profiles row was not created by the trigger: ${upErr.message}`)

  const client = anonClient()
  const { error: inErr } = await client.auth.signInWithPassword({
    email: p.email,
    password: p.password,
  })
  if (inErr) die(`could not sign in as the test account: ${inErr.message}`)
  return { id: data.user.id, client }
}

async function cleanup() {
  for (const id of made.slots) await admin.from('slots').delete().eq('id', id)
  for (const id of made.users) await admin.auth.admin.deleteUser(id).catch(() => {})
}

// ------------------------------------------------------------------- checks

async function main() {
  console.log('\nChecking the Supabase project\n')

  // --- schema is there at all
  console.log('Schema')
  for (const t of ['profiles', 'slots', 'bookings', 'notes', 'tasks', 'messages', 'files']) {
    await check(`table "${t}" exists`, async () => {
      const { error } = await admin.from(t).select('*').limit(1)
      return error ? error.message : null
    })
  }
  await check('view "roster" exists', async () => {
    const { error } = await admin.from('roster').select('*').limit(1)
    return error ? error.message : null
  })

  if (failed > 0) {
    console.log('\nThe migration has not run. Paste supabase/migrations/0001_init.sql')
    console.log('into the Supabase SQL editor first.\n')
    process.exit(1)
  }

  // --- accounts
  console.log('\nAccounts')
  const A = await createPerson(PEOPLE.admin, 'Verify', 'Admin')
  const P = await createPerson(PEOPLE.player, 'Verify', 'Player')
  const O = await createPerson(PEOPLE.other, 'Other', 'Player')
  console.log('  ✓ sign-up trigger created a profile for each account')
  passed++

  const pendingEmail = `verify-pending-${stamp}@example.com`
  const pendingPassword = `Vf!${stamp}dD`
  let pendingId = null
  let pendingClient = null

  await check('a new account starts out pending', async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: pendingEmail,
      password: pendingPassword,
      email_confirm: true,
      user_metadata: { first_name: 'Verify', last_name: 'Pending' },
    })
    if (error) return error.message
    pendingId = data.user.id
    made.users.push(pendingId)

    pendingClient = anonClient()
    await pendingClient.auth.signInWithPassword({ email: pendingEmail, password: pendingPassword })

    const { data: row } = await admin.from('profiles').select('status').eq('id', pendingId).single()
    return row?.status === 'pending' ? null : `status was "${row?.status}", expected "pending"`
  })

  // --- slots
  console.log('\nOffering times')
  const base = new Date(Date.now() + 7 * 24 * 3600_000)
  base.setUTCMinutes(0, 0, 0)
  const at = (offsetMin) => new Date(base.getTime() + offsetMin * 60_000).toISOString()

  let slotId = null
  await check('Winning Minds can offer a time', async () => {
    const { data, error } = await A.client
      .from('slots')
      .insert({ starts_at: at(0), duration_min: 30 })
      .select('id')
      .single()
    if (error) return error.message
    slotId = data.id
    made.slots.push(data.id)
    return null
  })

  await check('a second 30-minute call fits in the same hour', async () => {
    const { data, error } = await A.client
      .from('slots')
      .insert({ starts_at: at(30), duration_min: 30 })
      .select('id')
      .single()
    if (error) return error.message
    made.slots.push(data.id)
    return null
  })

  await check('an overlapping time is refused', async () => {
    const { error } = await A.client.from('slots').insert({ starts_at: at(15), duration_min: 45 })
    if (!error) return 'the overlap was accepted'
    return error.code === '23P01' ? null : `refused, but with ${error.code}: ${error.message}`
  })

  await check('a player cannot offer a time', async () => {
    const { error } = await P.client.from('slots').insert({ starts_at: at(600), duration_min: 45 })
    return error ? null : 'a player was allowed to create a slot'
  })

  // --- booking
  console.log('\nBooking')
  await check('a player can book a free time', async () => {
    const { error } = await P.client.from('bookings').insert({ slot_id: slotId, player_id: P.id })
    return error ? error.message : null
  })

  await check('a teammate cannot take the same time', async () => {
    const { error } = await O.client.from('bookings').insert({ slot_id: slotId, player_id: O.id })
    if (!error) return 'the slot was booked twice'
    return error.code === '23505' ? null : `refused, but with ${error.code}: ${error.message}`
  })

  await check('a player cannot book in someone else’s name', async () => {
    const { data: s } = await A.client
      .from('slots')
      .insert({ starts_at: at(1440), duration_min: 45 })
      .select('id')
      .single()
    if (s) made.slots.push(s.id)
    const { error } = await O.client.from('bookings').insert({ slot_id: s.id, player_id: P.id })
    return error ? null : 'a player booked a slot for a teammate'
  })

  // --- privacy
  console.log('\nWho can see what')
  await check('a player sees teammates in the roster', async () => {
    const { data, error } = await P.client.from('roster').select('id, first_name, last_name')
    if (error) return error.message
    return data.some((r) => r.id === O.id) ? null : 'the teammate was missing from the roster'
  })

  await check('the roster hands out no email address', async () => {
    const { error } = await P.client.from('roster').select('email')
    return error ? null : 'email was readable through the roster view'
  })

  await check('a player cannot read a teammate’s profile row', async () => {
    const { data, error } = await P.client.from('profiles').select('*').eq('id', O.id)
    if (error) return null
    return data.length === 0 ? null : 'a teammate’s profile row was readable'
  })

  await check('a player can read her own profile', async () => {
    const { data, error } = await P.client.from('profiles').select('*').eq('id', P.id)
    if (error) return error.message
    return data.length === 1 ? null : 'own profile row was not readable'
  })

  await check('a player cannot approve herself', async () => {
    const { error } = await P.client.from('profiles').update({ role: 'admin' }).eq('id', P.id)
    if (!error) {
      const { data } = await admin.from('profiles').select('role').eq('id', P.id).single()
      return data?.role === 'admin' ? 'a player made herself an admin' : null
    }
    return null
  })

  await check('a pending account cannot approve itself', async () => {
    if (!pendingClient) return 'the pending account was never created'
    await pendingClient.from('profiles').update({ status: 'active' }).eq('id', pendingId)
    const { data } = await admin.from('profiles').select('status').eq('id', pendingId).single()
    return data?.status === 'pending' ? null : `a pending account set itself to "${data?.status}"`
  })

  await check('a pending account can read nothing but its own row', async () => {
    if (!pendingClient) return 'the pending account was never created'
    const { data: slots } = await pendingClient.from('slots').select('*')
    if ((slots ?? []).length > 0) return 'a pending account could read the schedule'
    const { data: roster } = await pendingClient.from('roster').select('*')
    if ((roster ?? []).length > 0) return 'a pending account could read the roster'
    const { data: own } = await pendingClient.from('profiles').select('*').eq('id', pendingId)
    return (own ?? []).length === 1 ? null : 'a pending account could not read its own row'
  })

  await check('a player cannot read session notes', async () => {
    const { error } = await A.client.from('notes').insert({ player_id: P.id, body: 'verification note' })
    if (error) return `could not create the note to test with: ${error.message}`
    const { data, error: readErr } = await P.client.from('notes').select('*')
    if (readErr) return null
    return data.length === 0 ? null : 'a player read a session note about herself'
  })

  await check('Winning Minds can read every profile', async () => {
    const { data, error } = await A.client.from('profiles').select('id')
    if (error) return error.message
    return data.length >= 3 ? null : `only ${data.length} profiles were visible`
  })

  // --- the owner account
  console.log('\nThe owner account')
  const { data: owner } = await admin
    .from('profiles')
    .select('id, email')
    .eq('is_owner', true)
    .maybeSingle()

  await check('exactly one account is marked as the owner', async () =>
    owner ? null : 'no account has is_owner set'
  )

  await check('another admin cannot demote the owner', async () => {
    if (!owner) return 'no owner to test against'
    await A.client.from('profiles').update({ role: 'player' }).eq('id', owner.id)
    const { data } = await admin.from('profiles').select('role').eq('id', owner.id).single()
    return data?.role === 'admin' ? null : `the owner was demoted to "${data?.role}"`
  })

  await check('another admin cannot decline the owner', async () => {
    if (!owner) return 'no owner to test against'
    await A.client.from('profiles').update({ status: 'declined' }).eq('id', owner.id)
    const { data } = await admin.from('profiles').select('status').eq('id', owner.id).single()
    return data?.status === 'active' ? null : `the owner was set to "${data?.status}"`
  })

  await check('an admin cannot make itself the owner', async () => {
    await A.client.from('profiles').update({ is_owner: true }).eq('id', A.id)
    const { data } = await admin.from('profiles').select('is_owner').eq('id', A.id).single()
    return data?.is_owner === false ? null : 'an admin claimed the owner flag'
  })

  await check('only the owner can hand out the Winning Minds role', async () => {
    await A.client.from('profiles').update({ role: 'admin' }).eq('id', P.id)
    const { data } = await admin.from('profiles').select('role').eq('id', P.id).single()
    return data?.role === 'player' ? null : 'a non-owner admin promoted somebody to admin'
  })

  console.log('\nEverybody else')
  await check('a signed-out visitor can read nothing', async () => {
    const { data, error } = await anonClient().from('slots').select('*')
    if (error) return null
    return data.length === 0 ? null : `${data.length} slots were readable without signing in`
  })
}

main()
  .catch((err) => {
    failed++
    console.error(`\n  ✕ the run stopped: ${err.message}`)
  })
  .finally(async () => {
    await cleanup()
    console.log(`\n  ${passed} passed, ${failed} failed`)
    console.log('  test accounts and times removed\n')
    process.exit(failed > 0 ? 1 : 0)
  })
