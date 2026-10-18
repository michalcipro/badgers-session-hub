-- How long a call is.
--
-- It was a dropdown next to the calendar, so every click could produce a
-- different length and nothing held them together. It is one setting
-- instead: 30 minutes unless Winning Minds says otherwise, and the server
-- reads it rather than trusting whatever the page sends.

create table if not exists public.settings (
  id           boolean primary key default true,
  session_min  smallint not null default 30 check (session_min in (30, 45, 60)),
  updated_by   uuid references public.profiles(id) on delete set null,
  updated_at   timestamptz not null default now(),
  -- One row, and only one: the primary key can only ever be true.
  constraint settings_singleton check (id)
);

insert into public.settings (id) values (true) on conflict (id) do nothing;

alter table public.settings enable row level security;

-- Everyone signed in reads it; only Winning Minds changes it, and nobody
-- adds or removes the row.
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings
  for select using (public.is_active());

drop policy if exists settings_update on public.settings;
create policy settings_update on public.settings
  for update using (public.is_admin()) with check (public.is_admin());
