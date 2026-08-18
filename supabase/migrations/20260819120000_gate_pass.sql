-- Gate pass: courier signature + receive-back confirmation on orders

alter table public.orders
  add column if not exists gate_pass_signature_url text,
  add column if not exists gate_pass_issued_at timestamptz,
  add column if not exists gate_pass_received_at timestamptz;

-- ─── Storage: gate-pass-signatures (public read) ──────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gate-pass-signatures',
  'gate-pass-signatures',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "gate_pass_sig_public_read" on storage.objects;
create policy "gate_pass_sig_public_read" on storage.objects
  for select using (bucket_id = 'gate-pass-signatures');

drop policy if exists "gate_pass_sig_anon_insert" on storage.objects;
create policy "gate_pass_sig_anon_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'gate-pass-signatures');

drop policy if exists "gate_pass_sig_anon_update" on storage.objects;
create policy "gate_pass_sig_anon_update" on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'gate-pass-signatures')
  with check (bucket_id = 'gate-pass-signatures');

drop policy if exists "gate_pass_sig_anon_delete" on storage.objects;
create policy "gate_pass_sig_anon_delete" on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'gate-pass-signatures');
