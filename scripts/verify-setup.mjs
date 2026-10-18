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
const made = { users: [], slots: [], series: [] }

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
  // Rows tied to a test account go with it; these are not.
  await admin.from('files').delete().like('storage_path', `verify-%-${stamp}`)
  for (const id of made.slots) await admin.from('slots').delete().eq('id', id)
  for (const id of made.series) await admin.from('slot_series').delete().eq('id', id)
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

  await check('two of you can run calls at the same time', async () => {
    const { data, error } = await A.client
      .from('slots')
      .insert({ starts_at: at(0), duration_min: 30, lane: 2 })
      .select('id')
      .single()
    if (error) {
      return error.code === '23P01' || /lane/.test(error.message)
        ? 'a second parallel call was refused — run supabase/migrations/0007_parallel.sql'
        : error.message
    }
    made.slots.push(data.id)
    return null
  })

  await check('a repeating schedule can be recorded', async () => {
    const { data, error } = await A.client
      .from('slot_series')
      .insert({ created_by: A.id, source_week: '2026-10-19', ends_on: '2026-12-19' })
      .select('id')
      .single()
    if (error) {
      return /slot_series/.test(error.message)
        ? 'no repeating schedules — run supabase/migrations/0008_repeat.sql'
        : error.message
    }
    made.series.push(data.id)

    const { error: linkError } = await A.client
      .from('slots')
      .update({ series_id: data.id })
      .eq('id', made.slots[0])
    return linkError ? linkError.message : null
  })

  await check('a schedule may not end before it starts', async () => {
    const { error } = await A.client
      .from('slot_series')
      .insert({ created_by: A.id, source_week: '2026-12-19', ends_on: '2026-10-19' })
    return error ? null : 'a schedule ending before it began was accepted'
  })

  await check('a third call at the same time is refused', async () => {
    const { error } = await A.client
      .from('slots')
      .insert({ starts_at: at(0), duration_min: 30, lane: 2 })
    return error ? null : 'the same lane took two calls at once'
  })

  await check('one of you cannot be in two places at once', async () => {
    const { error } = await A.client
      .from('slots')
      .insert({ starts_at: at(15), duration_min: 45, lane: 1 })
    if (!error) return 'an overlap within one lane was accepted'
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

  // --- messages, tasks, notes, files
  console.log('\nTalking, tasks and files')

  await check('the file storage bucket exists', async () => {
    const { data, error } = await admin.storage.listBuckets()
    if (error) return error.message
    return data.some((b) => b.id === 'session-files')
      ? null
      : 'bucket "session-files" is missing — run supabase/migrations/0003_files.sql'
  })

  await check('a player can write in her own thread', async () => {
    const { error } = await P.client
      .from('messages')
      .insert({ subject_id: P.id, sender_id: P.id, body: 'verification message' })
    return error ? error.message : null
  })

  await check('a player cannot write in a teammate’s thread', async () => {
    const { error } = await P.client
      .from('messages')
      .insert({ subject_id: O.id, sender_id: P.id, body: 'should not land' })
    return error ? null : 'a player posted into a teammate’s thread'
  })

  await check('a player cannot read a teammate’s thread', async () => {
    await A.client.from('messages').insert({ subject_id: O.id, sender_id: A.id, body: 'private to Other' })
    const { data } = await P.client.from('messages').select('subject_id')
    return (data ?? []).every((m) => m.subject_id === P.id)
      ? null
      : 'a player read a message from another thread'
  })

  await check('Winning Minds can write in a player’s thread', async () => {
    const { error } = await A.client
      .from('messages')
      .insert({ subject_id: P.id, sender_id: A.id, body: 'reply from Winning Minds' })
    return error ? error.message : null
  })

  let taskId = null
  await check('Winning Minds can assign a task', async () => {
    const { data, error } = await A.client
      .from('tasks')
      .insert({ player_id: P.id, title: 'verification task', assigned_by: A.id })
      .select('id')
      .single()
    if (error) return error.message
    taskId = data.id
    return null
  })

  await check('a player can tick her own task off', async () => {
    const { error } = await P.client
      .from('tasks')
      .update({ done_at: new Date().toISOString() })
      .eq('id', taskId)
    if (error) return error.message
    const { data } = await admin.from('tasks').select('done_at').eq('id', taskId).single()
    return data?.done_at ? null : 'the task did not get ticked'
  })

  await check('a player cannot tick a teammate’s task off', async () => {
    const { data: t } = await A.client
      .from('tasks')
      .insert({ player_id: O.id, title: 'other player task', assigned_by: A.id })
      .select('id')
      .single()
    await P.client.from('tasks').update({ done_at: new Date().toISOString() }).eq('id', t.id)
    const { data } = await admin.from('tasks').select('done_at').eq('id', t.id).single()
    return data?.done_at === null ? null : 'a player ticked off a teammate’s task'
  })

  await check('a player cannot assign herself a task', async () => {
    const { error } = await P.client.from('tasks').insert({ player_id: P.id, title: 'self assigned' })
    return error ? null : 'a player created her own task'
  })

  await check('a team file reaches every player, a private one does not', async () => {
    await A.client.from('files').insert([
      { storage_path: `verify-team-${stamp}`, name: 'team.pdf', visible_to: null, uploaded_by: A.id },
      { storage_path: `verify-other-${stamp}`, name: 'other.pdf', visible_to: O.id, uploaded_by: A.id },
    ])
    const { data } = await P.client.from('files').select('name, visible_to')
    const names = (data ?? []).map((f) => f.name)
    if (!names.includes('team.pdf')) return 'the team file was not visible to a player'
    if (names.includes('other.pdf')) return 'a file meant for a teammate was visible'
    return null
  })

  await check('a player cannot upload a file herself', async () => {
    const { error } = await P.client
      .from('files')
      .insert({ storage_path: `verify-bad-${stamp}`, name: 'bad.pdf', uploaded_by: P.id })
    return error ? null : 'a player created a file row'
  })

  // --- consultations
  console.log('\nCoach consultations')

  const coach = await createPerson(
    { email: `verify-coach-${stamp}@example.com`, password: `Vf!${stamp}eE`, role: 'coach' },
    'Verify', 'Coach'
  )

  const soon = new Date(Date.now() + 10 * 24 * 3600_000).toISOString()
  let consultId = null

  await check('a coach can ask for a time of her own', async () => {
    const { data, error } = await coach.client
      .from('consultations')
      .insert({ coach_id: coach.id, requested_at: soon, duration_min: 45, topic: 'verification' })
      .select('id, status')
      .single()
    if (error) return `${error.message} — run supabase/migrations/0005_consultations.sql`
    consultId = data.id
    return data.status === 'requested' ? null : `it started as "${data.status}"`
  })

  await check('she cannot confirm her own request', async () => {
    if (!consultId) return 'no request to test with'
    await coach.client.from('consultations').update({ status: 'confirmed' }).eq('id', consultId)
    const { data } = await admin.from('consultations').select('status').eq('id', consultId).single()
    return data?.status === 'requested' ? null : `she set it to "${data?.status}"`
  })

  await check('a player cannot ask for a consultation', async () => {
    const { error } = await P.client
      .from('consultations')
      .insert({ coach_id: P.id, requested_at: soon, duration_min: 45 })
    return error ? null : 'a player created a consultation request'
  })

  await check('a player cannot read a coach’s request', async () => {
    const { data } = await P.client.from('consultations').select('id')
    return (data ?? []).length === 0 ? null : 'a player read a consultation request'
  })

  await check('Winning Minds can confirm it', async () => {
    if (!consultId) return 'no request to test with'
    const { data: slot, error: slotErr } = await A.client
      .from('slots')
      .insert({ starts_at: soon, duration_min: 45, kind: 'consultation' })
      .select('id')
      .single()
    if (slotErr) return slotErr.message
    made.slots.push(slot.id)
    const { error } = await A.client
      .from('consultations')
      .update({ status: 'confirmed', slot_id: slot.id, decided_by: A.id })
      .eq('id', consultId)
    return error ? error.message : null
  })

  await check('a player cannot book a consultation time', async () => {
    const slotId2 = made.slots[made.slots.length - 1]
    const { error } = await P.client.from('bookings').insert({ slot_id: slotId2, player_id: P.id })
    return error ? null : 'a player booked a time reserved for a coach'
  })

  await check('a player cannot even see that a consultation exists', async () => {
    const slotId2 = made.slots[made.slots.length - 1]
    const { data } = await P.client.from('slots').select('id').eq('id', slotId2)
    return (data ?? []).length === 0
      ? null
      : 'a player could read a consultation slot — run supabase/migrations/0006_slot_visibility.sql'
  })

  await check('a player cannot read the repeating schedules', async () => {
    const { data } = await P.client.from('slot_series').select('id')
    return (data ?? []).length === 0 ? null : 'a player could read the schedule table'
  })

  await check('a player cannot set a schedule up', async () => {
    const { error } = await P.client
      .from('slot_series')
      .insert({ created_by: P.id, source_week: '2026-10-19', ends_on: '2026-12-19' })
    return error ? null : 'a player created a repeating schedule'
  })

  await check('Winning Minds still sees every kind of slot', async () => {
    const slotId2 = made.slots[made.slots.length - 1]
    const { data } = await A.client.from('slots').select('id').eq('id', slotId2)
    return (data ?? []).length === 1 ? null : 'a consultation slot vanished for Winning Minds'
  })

  await check('a coach sees her own consultation in the calendar', async () => {
    const slotId2 = made.slots[made.slots.length - 1]
    const { data } = await coach.client.from('slots').select('id').eq('id', slotId2)
    return (data ?? []).length === 1 ? null : 'the coach could not see her own consultation slot'
  })

  // --- leaving the squad
  console.log('\nLeaving the squad')

  await check('a profile can be archived', async () => {
    const { error } = await admin.from('profiles').update({ status: 'archived' }).eq('id', O.id)
    return error
      ? `${error.message} — run supabase/migrations/0004_archive.sql`
      : null
  })

  await check('an archived player loses every permission', async () => {
    const { data: slots } = await O.client.from('slots').select('*')
    if ((slots ?? []).length > 0) return 'an archived player could still read the schedule'
    const { data: roster } = await O.client.from('roster').select('*')
    if ((roster ?? []).length > 0) return 'an archived player could still read the roster'
    const { error } = await O.client.from('bookings').insert({ slot_id: slotId, player_id: O.id })
    return error ? null : 'an archived player could still book'
  })

  await check('her record survives being archived', async () => {
    const { data } = await admin.from('tasks').select('id').eq('player_id', O.id)
    return (data ?? []).length > 0 ? null : 'her tasks disappeared when she was archived'
  })

  await check('bringing her back restores access', async () => {
    await admin.from('profiles').update({ status: 'active' }).eq('id', O.id)
    const { data } = await O.client.from('roster').select('id')
    return (data ?? []).length > 0 ? null : 'she could not read the roster again'
  })

  await check('deleting an account takes her rows with it', async () => {
    const { data: before } = await admin.from('tasks').select('id').eq('player_id', O.id)
    if ((before ?? []).length === 0) return 'no rows to check against'
    await admin.auth.admin.deleteUser(O.id)
    made.users = made.users.filter((id) => id !== O.id)
    const { data: after } = await admin.from('tasks').select('id').eq('player_id', O.id)
    const { data: profile } = await admin.from('profiles').select('id').eq('id', O.id)
    if ((after ?? []).length > 0) return 'her tasks outlived the account'
    return (profile ?? []).length === 0 ? null : 'her profile outlived the account'
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
