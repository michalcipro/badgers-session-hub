-- A repeating schedule.
--
-- One week in the grid is the pattern; this table only records that the
-- pattern was rolled forward and how far. The slots themselves stay the
-- single source of truth, so taking one out for a holiday is nothing
-- more than deleting that slot, and the rest of the series is untouched.

create table if not exists public.slot_series (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null references public.profiles(id) on delete cascade,
  source_week date not null,
  ends_on     date not null,
  created_at  timestamptz not null default now(),
  constraint slot_series_order check (ends_on >= source_week)
);

alter table public.slots
  add column if not exists series_id uuid references public.slot_series(id) on delete set null;

create index if not exists slots_series_idx
  on public.slots (series_id) where series_id is not null;

alter table public.slot_series enable row level security;

-- Coaches may see that a schedule runs; only Winning Minds sets one up.
drop policy if exists slot_series_select on public.slot_series;
create policy slot_series_select on public.slot_series
  for select using (public.is_staff());

drop policy if exists slot_series_write on public.slot_series;
create policy slot_series_write on public.slot_series
  for all using (public.is_admin()) with check (public.is_admin());
