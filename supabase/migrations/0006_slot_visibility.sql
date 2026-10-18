-- Players should not be able to read a consultation at all.
--
-- The week grid already left them out, but that was the application
-- deciding, and everywhere else in this schema the database decides. A
-- player could still have asked the API directly and learnt that a block
-- of time exists. No name and no topic came with it, so little was at
-- stake, but the rule belongs here with the others.

drop policy slots_select on slots;

create policy slots_select on slots for select
  using (
    public.is_active()
    and (kind = 'player' or public.is_staff())
  );
