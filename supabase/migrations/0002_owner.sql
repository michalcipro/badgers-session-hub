-- The owner account.
--
-- One account stands above the others: it cannot be demoted, declined or
-- edited by anybody else, and it is the only account that can hand out the
-- Winning Minds role. Without this, any admin could demote any other admin,
-- including the person who set the whole thing up.
--
-- The flag itself is deliberately out of reach of the application: it is
-- only settable with the service role key, never by a signed-in user.

alter table profiles
  add column is_owner boolean not null default false;

-- At most one owner, ever.
create unique index profiles_one_owner on profiles (is_owner) where is_owner;

-- The owner can never be locked out by a role or status change.
alter table profiles
  add constraint owner_is_active_admin
  check (not is_owner or (role = 'admin' and status = 'active'));

create function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and is_owner
  )
$$;

-- auth.uid() is null when the service role is used, so the flag can be set
-- from a migration or a script but not from inside the app.
create function public.guard_owner_flag()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_owner is distinct from old.is_owner and auth.uid() is not null then
    raise exception 'is_owner cannot be changed from the application';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_owner
  before update on profiles
  for each row execute function public.guard_owner_flag();

-- Admins may still manage everyone else, but:
--   * nobody but the owner may touch the owner's row
--   * only the owner may grant the Winning Minds role
drop policy profiles_admin_write on profiles;

create policy profiles_admin_write on profiles for update
  using (
    public.is_admin()
    and (not is_owner or id = auth.uid())
  )
  with check (
    public.is_admin()
    and (not is_owner or id = auth.uid())
    and (role <> 'admin' or public.is_owner() or id = auth.uid())
  );
