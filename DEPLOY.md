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

## Where it stands

Deployed and running at **https://badgers-session-hub.vercel.app** against
the live Frankfurt database. The domain does not point there yet, so only
someone who knows this address can reach it.

The account is on Vercel's **Hobby** plan. Two consequences:

- Hobby allows only one cron run a day, so the reminder is set to
  `0 16 * * *` (18:00 Prague, 11:00 Madison) instead of hourly. Every
  booking still gets exactly one reminder, sent during the day before the
  call rather than 24 hours ahead to the hour.
- Hobby is for personal, non-commercial use. Running a company's tool on
  it is outside those terms. Upgrading to Pro ($20/month) settles that and
  lets the cron go back to `0 * * * *`.

## 2. Create the Vercel project and set the environment

Done. The project `badgers-session-hub` is linked to the GitHub repo, so
every push to `main` deploys itself. These four are set for Production:

| Variable | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | the **new** secret key from step 1 |
| `CRON_SECRET` | generated, in `.env.local` and in Vercel |

When you rotate the service role key, change it in **both** `.env.local`
and Vercel, or the reminder cron stops working.

`RESEND_API_KEY` and `EMAIL_FROM` stay empty until email is set up. Booking
works without them; the confirmation and reminder are simply skipped.

## 3. Deploy

```bash
vercel deploy --prod
```

Done once already; pushing to `main` does it automatically from now on.

## 4. Point the domain — **you**

Both names are already added to the Vercel project and ownership is
verified. All that is left is the DNS, in the Webglobe editor:

| Host | Type | Value |
| --- | --- | --- |
| `@` | **A** | `216.198.79.1` |
| `www` | **CNAME** | `9514fde62d631713.vercel-dns-017.com.` |

`@` currently points at `195.181.249.108`, the Webglobe webhosting —
replace that value. `www` is an A record today; delete it and add the
CNAME in its place, as a host cannot have both.

**Leave the MX records and the two SPF `TXT` records exactly as they are.**
Mail for the domain runs on Webglobe and nothing here touches it. For the
same reason do not switch the nameservers to Vercel, even though Vercel
suggests it — that would move the mail records too.

DNS can take a few hours. Vercel issues the certificate on its own once
the records resolve. To watch it:

```bash
vercel domains verify winningmindsperformance.com
```

## 5. Tell Supabase the new address — **you**

Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://winningmindsperformance.com`
- **Redirect URLs**: add `https://winningmindsperformance.com/**`

Without this, password resets and confirmation links point at localhost.

## 6. Check it on the real domain

- Sign in as yourself
- Offer a time in Availability and confirm it appears
- Vercel → **Cron Jobs**: the daily reminder should be listed

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
