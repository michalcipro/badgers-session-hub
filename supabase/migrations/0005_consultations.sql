-- Consultations for coaching staff.
--
-- A coach asks for a time of her own, outside the squares offered to
-- players, and nothing is agreed until Winning Minds confirms it. On
-- confirmation the request grows a real slot, so it occupies the calendar
-- like any other call and the no-overlap constraint protects it.
--
-- Players never see these, and a coach still cannot take a player's time.

create type slot_kind as enum ('player', 'consultation');
create type consultation_status as enum ('requested', 'confirmed', 'declined', 'cancelled');

alter table slots add column kind slot_kind not null default 'player';

-- A player may only book the times meant for players, so a confirmed
-- consultation can never be taken by somebody else.
drop policy bookings_insert_own on bookings;

create policy bookings_insert_own on bookings for insert
  with check (
    public.is_active()
    and player_id = auth.uid()
    and public.my_role() = 'player'
    and exists (
      select 1 from slots s
      where s.id = slot_id and s.starts_at > now() and s.kind = 'player'
    )
  );

create table consultations (
  id           uuid        primary key default gen_random_uuid(),
  coach_id     uuid        not null references profiles(id) on delete cascade,
  requested_at timestamptz not null,
  duration_min int         not null default 45
                           check (duration_min in (30, 45, 60)),
  topic        text,
  status       consultation_status not null default 'requested',
  slot_id      uuid        references slots(id) on delete set null,
  decided_by   uuid        references profiles(id) on delete set null,
  decided_at   timestamptz,
  note         text,                    -- what Winning Minds said back
  created_at   timestamptz not null default now()
);

create index consultations_coach_idx on consultations (coach_id, requested_at);
create index consultations_status_idx on consultations (status);

alter table consultations enable row level security;

-- A coach sees only her own requests; Winning Minds sees all of them.
create policy consultations_select on consultations for select
  using (coach_id = auth.uid() or public.is_admin());

-- She may ask, for herself, for a time in the future, and only as a request.
create policy consultations_insert on consultations for insert
  with check (
    public.is_active()
    and coach_id = auth.uid()
    and public.my_role() = 'coach'
    and status = 'requested'
    and requested_at > now()
  );

-- She may withdraw one she has not had an answer to yet.
create policy consultations_cancel_own on consultations for update
  using (coach_id = auth.uid() and status = 'requested')
  with check (coach_id = auth.uid() and status = 'cancelled');

-- Answering belongs to Winning Minds.
create policy consultations_admin on consultations for all
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on consultations to authenticated;
