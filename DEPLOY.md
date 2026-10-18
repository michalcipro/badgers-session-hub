# Going live on winningmindsperformance.com

The app is a Next.js server application, so it needs a Node runtime. Plain
Webglobe webhosting is PHP and cannot run it. The domain stays registered
at Webglobe; only its DNS points at Vercel, where the app runs.

Done in order. Steps marked **you** need the Supabase or Webglobe console.

## 1. Rotate the service role key — **you**

The current key was shown in a chat screenshot, so it should not go into
production.

Supabase → **Settings → API Keys** → **New secret key** → copy it into
`.env.local` on the `SUPABASE_SERVICE_ROLE_KEY` line → back in Supabase,
delete the old `default` secret key from the ⋮ menu.

Nothing else uses it yet, so nothing breaks.

## 2. Create the Vercel project and set the environment

From the repo:

```bash
vercel link
```

Then the four values, all for **Production** (and Preview, if you want
preview deployments to work):

| Variable | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | the **new** secret key from step 1 |
| `CRON_SECRET` | already generated in `.env.local` |

`RESEND_API_KEY` and `EMAIL_FROM` stay empty until email is set up. Booking
works without them; the confirmation and reminder are simply skipped.

## 3. Deploy a preview first

```bash
vercel deploy
```

Open the preview URL and sign in. If that works, the production deployment
will too.

## 4. Point the domain — **you**

In Vercel, add `winningmindsperformance.com` and `www` to the project.
Vercel shows the exact records. In the Webglobe DNS editor:

- `@` → **A** record → the address Vercel gives
- `www` → **CNAME** → the target Vercel gives

Leave MX records alone if email runs on that domain — changing A and CNAME
does not affect mail.

DNS can take a few hours. Vercel issues the certificate once it resolves.

## 5. Tell Supabase the new address — **you**

Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://winningmindsperformance.com`
- **Redirect URLs**: add `https://winningmindsperformance.com/**`

Without this, password resets and confirmation links point at localhost.

## 6. Go live

```bash
vercel deploy --prod
```

## 7. Check it

- Sign in as yourself on the real domain
- Offer a time in Availability, confirm it appears
- Vercel → **Cron Jobs**: the hourly reminder should be listed

## Still open

**Email.** Supabase's built-in mailer allows only a handful of messages an
hour, which is why sign-up hit a rate limit during testing. Twenty players
cannot register through it. Either add them yourself from the approvals
queue, or set up Resend as the SMTP provider in Supabase
(**Authentication → Emails → SMTP Settings**), which also switches on the
booking confirmation and the 24-hour reminder that are already built.

**Confirm email** is currently off. Turn it back on once SMTP works.

## Cost

| | |
| --- | --- |
| Supabase Pro | $25 / month |
| Vercel | Pro is required for commercial use |
| Resend | free up to 3,000 emails a month |
| Domain | already yours |
