-- Storage for session materials.
--
-- The bucket is private and has no policies of its own: nothing reaches it
-- from a browser. The app reads the matching row in public.files with the
-- signed-in user's own client first, so row-level security decides whether
-- that person may have the file, and only then mints a short-lived signed
-- URL. One place to get a file, one place that decides.

insert into storage.buckets (id, name, public)
values ('session-files', 'session-files', false)
on conflict (id) do nothing;

-- Who uploaded a file is worth knowing; who it is for already is on the row.
create index if not exists files_visible_to_idx on files (visible_to);
create index if not exists tasks_player_idx on tasks (player_id, done_at);
