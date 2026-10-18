-- A file on a message.
--
-- It lives on the message rather than in `files`, and that is the whole
-- point: who may read a message is already settled by messages' own
-- policies, so an attachment needs no visibility rules of its own and
-- cannot drift from them. It also keeps the Library a library, rather
-- than a pile of everything anybody ever sent.
--
-- One upload, one object in storage, and a row per recipient pointing at
-- it. Nothing deletes messages, so nothing orphans the object.

alter table public.messages
  add column if not exists file_path text,
  add column if not exists file_name text,
  add column if not exists file_size bigint;

-- A message is either words, or a file, or both — never nothing.
alter table public.messages drop constraint if exists messages_has_content;
alter table public.messages add constraint messages_has_content
  check (length(btrim(body)) > 0 or file_path is not null);

-- Both halves of the attachment or neither.
alter table public.messages drop constraint if exists messages_file_pair;
alter table public.messages add constraint messages_file_pair
  check ((file_path is null) = (file_name is null));
