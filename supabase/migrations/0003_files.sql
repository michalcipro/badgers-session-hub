-- Indexes for the file and task lists.
--
-- The storage bucket itself is NOT created here: on hosted Supabase an
-- insert into storage.buckets from the SQL editor does not take effect.
-- Run `npm run setup:storage` instead, which creates a private bucket
-- called "session-files" through the API.
--
-- The bucket deliberately has no policies of its own, so nothing reaches
-- it from a browser. The app reads the matching row in public.files with
-- the signed-in user's own client first, letting row-level security decide
-- whether that person may have the file, and only then mints a short-lived
-- signed URL.

create index if not exists files_visible_to_idx on files (visible_to);
create index if not exists tasks_player_idx on tasks (player_id, done_at);
