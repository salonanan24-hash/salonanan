-- Public media bucket for catalog and ad images (URLs in DB instead of base64).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read media" on storage.objects;
create policy "Public read media"
on storage.objects
for select
to public
using (bucket_id = 'media');

notify pgrst, 'reload schema';
