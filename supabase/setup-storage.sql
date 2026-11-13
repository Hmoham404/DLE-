-- MYC Smart Factory — current server-side Supabase Storage backend.
-- Supabase Dashboard > SQL Editor > New query > paste > Run.
-- No API keys or access codes belong in this SQL file.
-- Safe to run again; existing files are retained.

begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'myc-smart-factory-private',
  'myc-smart-factory-private',
  false,
  4000000,
  array['application/json']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

commit;

-- Expected: one row, public = false.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'myc-smart-factory-private';
