-- When she last looked at her messages.
--
-- Without this there is no such thing as unread: the best the app could
-- do is "they wrote last", which stays lit after she has read it and so
-- teaches her to ignore it. One timestamp, written when she opens the
-- page, is enough to tell her honestly that something is waiting.

alter table public.profiles
  add column if not exists messages_seen_at timestamptz;

-- She may set it on her own row, which profiles_update_own already
-- allows; that policy pins role and status, so nothing else opens up.
