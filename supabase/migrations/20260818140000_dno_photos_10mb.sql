-- Raise dno-photos bucket limit to 10 MB (was 5 MB)
update storage.buckets
set
  file_size_limit = 10485760,
  public = true,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
where id = 'dno-photos';
