-- Badgers Session Hub — initial schema
--
-- Run this once in the Supabase SQL editor (or `supabase db push`).
--
-- The privacy rules of this product are enforced here, not in the UI:
-- a player can read her own notes, tasks, files and messages and nothing
-- else, and coaching staff can see bookings and attendance but never the
-- content of a session. A bug in the app cannot leak what the database
-- refuses to return.

-- ---------------------------------------------------------------- types

create type user_role   as enum ('admin', 'coach', 'player');
create type user_status as enum ('pending', 'active', 'declined');

-- ------------------------------------------------------------- profiles

create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text        not null,
  first_name  text        not null default '',
  last_name   text        not null default '',
  role        user_role   not null default 'player',
  status      user_status not null default 'pending',
  class_year  text,                       -- players: Fr / So / Jr / Sr
  title       text,                       -- staff: "Head coach"
  created_at  timestamptz not null default now()
);

-- Every new sign-up gets a profile, always pending. Nothing is visible to
-- the person until Winning Minds approves it and picks the role.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name',  '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------- RLS helper functions
-- security definer, so a policy on profiles can ask about the caller's own
-- profile without recursing into that same policy.

create function public.my_role() returns user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.my_status() returns user_status
language sql stable security definer set search_path = '' as $$
  select status from public.profiles where id = auth.uid()
$$;

create function public.is_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  )
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active' and role = 'admin'
  )
$$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active' and role in ('admin', 'coach')
  )
$$;

-- ---------------------------------------------------------------- slots
-- starts_at is one absolute instant. Prague and Madison are only two ways
-- of displaying it, so a daylight-saving change can never shift a call.
--
-- Two 30-minute slots fit inside one hour (14:00 and 14:30). The exclusion
-- constraint stops them from overlapping, so a 45-minute slot at 14:00 and
-- another at 14:30 is rejected rather than silently double-booking you.

create table slots (
  id           uuid        primary key default gen_random_uuid(),
  starts_at    timestamptz not null,
  duration_min int         not null default 45
                           check (duration_min in (30, 45, 60)),
  meet_url     text,
  created_by   uuid        references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),

  -- The time the call occupies. Filled in by the trigger below, never by
  -- the app. It exists as a stored column because `timestamptz + interval`
  -- is only STABLE, not IMMUTABLE, so it cannot go in an index expression.
  span         tstzrange   not null,

  constraint slots_no_overlap exclude using gist (span with &&)
);

create function public.slots_set_span()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.span := tstzrange(
    new.starts_at,
    new.starts_at + make_interval(mins => new.duration_min)
  );
  return new;
end;
$$;

create trigger slots_span
  before insert or update of starts_at, duration_min on slots
  for each row execute function public.slots_set_span();

create index slots_starts_at_idx on slots (starts_at);

-- ------------------------------------------------------------- bookings
-- One booking per slot, enforced by the unique constraint: if two players
-- tap the same square at the same moment, one succeeds and the other gets
-- a conflict instead of a lost booking.

create table bookings (
  id                     uuid        primary key default gen_random_uuid(),
  slot_id                uuid        not null unique
                                     references slots(id) on delete cascade,
  player_id              uuid        not null
                                     references profiles(id) on delete cascade,
  attended               boolean,
  created_at             timestamptz not null default now(),
  confirmation_sent_at   timestamptz,   -- booking confirmation email
  reminder_sent_at       timestamptz    -- 24-hour reminder email
);

create index bookings_player_idx on bookings (player_id);

-- -------------------------------------------------- session content
-- notes are Winning Minds' own record of a call and are never readable by
-- the player they are about, nor by coaching staff.

create table notes (
  id         uuid        primary key default gen_random_uuid(),
  player_id  uuid        not null references profiles(id) on delete cascade,
  author_id  uuid        references profiles(id) on delete set null,
  body       text        not null,
  created_at timestamptz not null default now()
);

create table tasks (
  id          uuid        primary key default gen_random_uuid(),
  player_id   uuid        not null references profiles(id) on delete cascade,
  title       text        not null,
  due_on      date,
  done_at     timestamptz,
  assigned_by uuid        references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table messages (
  id         uuid        primary key default gen_random_uuid(),
  subject_id uuid        not null references profiles(id) on delete cascade,
  sender_id  uuid        not null references profiles(id) on delete cascade,
  body       text        not null,
  created_at timestamptz not null default now()
);

create index messages_subject_idx on messages (subject_id, created_at);

-- visible_to null = the whole team; otherwise one player.
create table files (
  id           uuid        primary key default gen_random_uuid(),
  storage_path text        not null,
  name         text        not null,
  size_bytes   bigint,
  visible_to   uuid        references profiles(id) on delete cascade,
  uploaded_by  uuid        references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------------ RLS

alter table profiles enable row level security;
alter table slots    enable row level security;
alter table bookings enable row level security;
alter table notes    enable row level security;
alter table tasks    enable row level security;
alter table messages enable row level security;
alter table files    enable row level security;

-- profiles: your own row, or everything if you are Winning Minds.
create policy profiles_select_own on profiles for select
  using (id = auth.uid() or public.is_admin());

-- You may edit your own row, but neither your role nor your status: without
-- the status check a pending account could approve itself.
create policy profiles_update_own on profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = public.my_role()
    and status = public.my_status()
  );

create policy profiles_admin_write on profiles for update
  using (public.is_admin()) with check (public.is_admin());

-- The roster every active member may read: names and role, nothing else.
-- Deliberately NOT security_invoker, so it can expose these four columns
-- without opening up the profiles table itself.
create view roster
with (security_invoker = false) as
  select id, first_name, last_name, role, class_year, title
  from profiles
  where status = 'active' and public.is_active();

-- slots: anyone active can read them; only Winning Minds creates them.
create policy slots_select on slots for select using (public.is_active());
create policy slots_admin  on slots for all
  using (public.is_admin()) with check (public.is_admin());

-- bookings: everyone active sees who is booked (names are public anyway),
-- a player books and cancels only for herself, Winning Minds does anything.
create policy bookings_select on bookings for select using (public.is_active());

create policy bookings_insert_own on bookings for insert
  with check (
    public.is_active()
    and player_id = auth.uid()
    and public.my_role() = 'player'
    and exists (select 1 from slots s where s.id = slot_id and s.starts_at > now())
  );

create policy bookings_delete_own on bookings for delete
  using (player_id = auth.uid() and public.is_active());

create policy bookings_admin on bookings for all
  using (public.is_admin()) with check (public.is_admin());

-- notes: Winning Minds only, in every direction.
create policy notes_admin on notes for all
  using (public.is_admin()) with check (public.is_admin());

-- tasks: a player reads her own and may tick them off; nothing else.
create policy tasks_select on tasks for select
  using (player_id = auth.uid() or public.is_admin());

-- Row-level security cannot limit this to the done_at column, so a player
-- can also edit the wording of her own task. Harmless today; when tasks get
-- a UI, replace this with a security-definer function that only ticks.
create policy tasks_tick_own on tasks for update
  using (player_id = auth.uid() and public.is_active())
  with check (player_id = auth.uid());

create policy tasks_admin on tasks for all
  using (public.is_admin()) with check (public.is_admin());

-- messages: a thread belongs to one person and Winning Minds. A coach
-- reads her own thread only, never a player's.
create policy messages_select on messages for select
  using (subject_id = auth.uid() or public.is_admin());

create policy messages_insert on messages for insert
  with check (
    public.is_active()
    and sender_id = auth.uid()
    and (subject_id = auth.uid() or public.is_admin())
  );

-- files: team-wide, or addressed to you.
create policy files_select on files for select
  using (public.is_active() and (visible_to is null or visible_to = auth.uid() or public.is_admin()));

create policy files_admin on files for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- grants

grant usage on schema public to anon, authenticated;
grant select on roster to authenticated;
grant select, insert, update, delete
  on profiles, slots, bookings, notes, tasks, messages, files
  to authenticated;
