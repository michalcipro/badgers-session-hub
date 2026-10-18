# Badgers Session Hub

Scheduling and communication between **Winning Minds** and the **Wisconsin
Badgers women's tennis** team.

Every two weeks Winning Minds opens call times. Players book the one that
fits, and everything around the call — Google Meet link, notes, tasks,
files, messages — lives in the same place.

- **App** — Next.js + Supabase, in this folder. Under construction.
- **Prototype** — `docs/`, published at
  <https://michalcipro.github.io/badgers-session-hub/>. Clickable, no backend,
  state resets on reload. It is the reference for what the app should do.

## Where the app is

Working now:

- Sign-up with email and password, sign-in, sign-out
- Every new account lands in **pending** and sees a holding screen only
- Winning Minds approves an account and picks the role (player / coach /
  Winning Minds)
- Each role lands on its own page; signed-out visitors are sent to sign-in
- Database schema with row-level security for the whole product

Not built yet:

- The weekly availability calendar and booking
- Booking confirmation and the 24-hour reminder email
- Messages, tasks, files, session notes
- Czech translation, Google Meet link generation

## Setting it up

### 1. Supabase

Create a project at [supabase.com](https://supabase.com). Pick the **EU
(Frankfurt)** region — session notes are sensitive personal data under GDPR
and Winning Minds is a European company.

Use the **Pro** plan. On the free plan a project pauses after seven days of
inactivity, and with calls every fortnight the app would be asleep whenever
someone wanted to book.

Open the SQL editor and run `supabase/migrations/0001_init.sql`.

Then under **Authentication → Providers → Email**, turn off "Confirm email"
while testing, or set up SMTP so confirmation mails actually arrive.

### 2. Environment

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from
**Project Settings → API**. The Resend and cron values are not used yet.

### 3. Run it

```bash
npm install && npm run dev
```

Open <http://localhost:3000>. Sign up — you will land on the pending screen.
To make yourself an admin, run this once in the Supabase SQL editor:

```sql
update profiles set status = 'active', role = 'admin' where email = 'you@example.com';
```

From then on you approve everyone else from the app.

## How the privacy rules work

They live in the database, not in the UI, so a bug in a page cannot leak a
session note. `supabase/migrations/0001_init.sql` is the readable version;
in short:

| | Winning Minds | Player | Coach |
| --- | :---: | :---: | :---: |
| Create call times | ● | | |
| Book a time | | ● | |
| See who booked (name only) | ● | ● | ● |
| Private session notes | ● | | |
| Own tasks and files | ● | ● | |
| Read another player's messages | | | |
| Approve accounts | ● | | |

Players read each other only through the `roster` view, which exposes names
and role and nothing else.

## Time zones

A slot is stored as one absolute instant. Prague (24-hour) and Madison
(12-hour) are two renderings of it, so a daylight-saving change can never
shift a call. The gap is 7 hours most of the year and 6 for a few weeks each
spring and autumn, because the EU and the US change clocks on different
dates — `lib/time.ts` reads that from the time zone data rather than assuming
it.

Two 30-minute calls fit inside one hour. The `slots_no_overlap` constraint
stops times from overlapping, so a 45-minute slot at 14:00 and another at
14:30 is rejected instead of quietly double-booking.

## Layout

```
app/              Next.js App Router pages and server actions
lib/              Supabase clients, auth helpers, time zone maths
supabase/         SQL migrations — the schema and all access rules
docs/             The clickable prototype, served by GitHub Pages
```

`docs/session-hub.html` is the prototype source; `npm run prototype` wraps it
into `docs/index.html`, which is what Pages serves.
