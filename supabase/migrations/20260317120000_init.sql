-- DHARI Home schema: tables, RLS, storage, seed, order RPC

create extension if not exists "pgcrypto";

-- ─── dno_master ───────────────────────────────────────────────
create table if not exists public.dno_master (
  id uuid primary key default gen_random_uuid(),
  dno_number text not null unique,
  photo_url text,
  size text not null default '5ft x 4ft',
  manufacturer text not null default 'Jaisal Fashion Weave'
    check (manufacturer in ('Jaisal Fashion Weave', 'Other')),
  other_manufacturer_name text,
  purchase_rate numeric(12,2),
  category text,
  hsn_code text default '6304',
  gst_rate numeric(5,2) not null default 12,
  date_added date not null default current_date
);

-- ─── stock_movements ──────────────────────────────────────────
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  dno_id uuid not null references public.dno_master(id) on delete restrict,
  type text not null check (type in ('IN', 'OUT')),
  qty integer not null check (qty > 0),
  date date not null default current_date,
  note text
);

create index if not exists stock_movements_dno_id_idx on public.stock_movements(dno_id);
create index if not exists stock_movements_date_idx on public.stock_movements(date desc);

-- ─── orders ───────────────────────────────────────────────────
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_date date not null default current_date,
  dno_id uuid not null references public.dno_master(id) on delete restrict,
  platform text not null
    check (platform in ('Flipkart', 'Amazon', 'Meesho', 'Myntra', 'Website', 'Other')),
  platform_order_id text,
  pieces integer not null check (pieces > 0),
  sale_rate numeric(12,2) not null,
  buyer_name text,
  buyer_state text,
  courier text,
  awb_number text,
  payment_status text not null default 'Prepaid'
    check (payment_status in ('Prepaid', 'COD Pending', 'COD Received')),
  invoice_no text
);

create index if not exists orders_dno_id_idx on public.orders(dno_id);
create index if not exists orders_order_date_idx on public.orders(order_date desc);

-- ─── stock balance helper ─────────────────────────────────────
create or replace function public.dno_stock_balance(p_dno_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    case when type = 'IN' then qty else -qty end
  ), 0)::integer
  from public.stock_movements
  where dno_id = p_dno_id;
$$;

-- ─── create order + OUT movement in one transaction ───────────
create or replace function public.create_order_with_stock(
  p_order_date date,
  p_dno_id uuid,
  p_platform text,
  p_platform_order_id text,
  p_pieces integer,
  p_sale_rate numeric,
  p_buyer_name text,
  p_buyer_state text,
  p_courier text,
  p_awb_number text,
  p_payment_status text,
  p_invoice_no text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_order public.orders;
begin
  if p_pieces is null or p_pieces <= 0 then
    raise exception 'Pieces must be greater than 0';
  end if;

  select public.dno_stock_balance(p_dno_id) into v_balance;
  if v_balance < p_pieces then
    raise exception 'Insufficient stock: available %, requested %', v_balance, p_pieces;
  end if;

  insert into public.orders (
    order_date, dno_id, platform, platform_order_id, pieces, sale_rate,
    buyer_name, buyer_state, courier, awb_number, payment_status, invoice_no
  ) values (
    coalesce(p_order_date, current_date),
    p_dno_id,
    p_platform,
    p_platform_order_id,
    p_pieces,
    p_sale_rate,
    p_buyer_name,
    p_buyer_state,
    p_courier,
    p_awb_number,
    coalesce(p_payment_status, 'Prepaid'),
    p_invoice_no
  )
  returning * into v_order;

  insert into public.stock_movements (dno_id, type, qty, date, note)
  values (
    p_dno_id,
    'OUT',
    p_pieces,
    coalesce(p_order_date, current_date),
    'Order ' || coalesce(v_order.platform_order_id, v_order.id::text)
  );

  return v_order;
end;
$$;

grant execute on function public.dno_stock_balance(uuid) to anon, authenticated, service_role;
grant execute on function public.create_order_with_stock(
  date, uuid, text, text, integer, numeric, text, text, text, text, text, text
) to anon, authenticated, service_role;

-- ─── RLS ──────────────────────────────────────────────────────
alter table public.dno_master enable row level security;
alter table public.stock_movements enable row level security;
alter table public.orders enable row level security;

drop policy if exists "anon_all_dno_master" on public.dno_master;
create policy "anon_all_dno_master" on public.dno_master
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "anon_all_stock_movements" on public.stock_movements;
create policy "anon_all_stock_movements" on public.stock_movements
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "anon_all_orders" on public.orders;
create policy "anon_all_orders" on public.orders
  for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.dno_master to anon, authenticated, service_role;
grant select, insert, update, delete on public.stock_movements to anon, authenticated, service_role;
grant select, insert, update, delete on public.orders to anon, authenticated, service_role;

-- ─── Storage: dno-photos (public read) ────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dno-photos',
  'dno-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "dno_photos_public_read" on storage.objects;
create policy "dno_photos_public_read" on storage.objects
  for select to public
  using (bucket_id = 'dno-photos');

drop policy if exists "dno_photos_anon_insert" on storage.objects;
create policy "dno_photos_anon_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'dno-photos');

drop policy if exists "dno_photos_anon_update" on storage.objects;
create policy "dno_photos_anon_update" on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'dno-photos')
  with check (bucket_id = 'dno-photos');

drop policy if exists "dno_photos_anon_delete" on storage.objects;
create policy "dno_photos_anon_delete" on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'dno-photos');

-- ─── Seed dno_master DH-0001 .. DH-0021 ───────────────────────
-- Roughly even split: 11 × 5ft x 4ft, 10 × 7ft x 4ft
insert into public.dno_master (dno_number, size, manufacturer, hsn_code, gst_rate, date_added)
values
  ('DH-0001', '5ft x 4ft', 'Jaisal Fashion Weave', '6304', 12, current_date),
  ('DH-0002', '5ft x 4ft', 'Jaisal Fashion Weave', '6304', 12, current_date),
  ('DH-0003', '5ft x 4ft', 'Jaisal Fashion Weave', '6304', 12, current_date),
  ('DH-0004', '5ft x 4ft', 'Jaisal Fashion Weave', '6304', 12, current_date),
  ('DH-0005', '5ft x 4ft', 'Jaisal Fashion Weave', '6304', 12, current_date),
  ('DH-0006', '5ft x 4ft', 'Jaisal Fashion Weave', '6304', 12, current_date),
  ('DH-0007', '5ft x 4ft', 'Jaisal Fashion Weave', '6304', 12, current_date),
  ('DH-0008', '5ft x 4ft', 'Jaisal Fashion Weave', '6304', 12, current_date),
  ('DH-0009', '5ft x 4ft', 'Jaisal Fashion Weave', '6304', 12, current_date),
  ('DH-0010', '5ft x 4ft', 'Jaisal Fashion Weave', '6304', 12, current_date),
  ('DH-0011', '5ft x 4ft', 'Jaisal Fashion Weave', '6304', 12, current_date),
  ('DH-0012', '7ft x 4ft', 'Jaisal Fashion Weave', '6304', 12, current_date),
  ('DH-0013', '7ft x 4ft', 'Jaisal Fashion Weave', '6304', 12, current_date),
  ('DH-0014', '7ft x 4ft', 'Jaisal Fashion Weave', '6304', 12, current_date),
  ('DH-0015', '7ft x 4ft', 'Jaisal Fashion Weave', '6304', 12, current_date),
  ('DH-0016', '7ft x 4ft', 'Jaisal Fashion Weave', '6304', 12, current_date),
  ('DH-0017', '7ft x 4ft', 'Jaisal Fashion Weave', '6304', 12, current_date),
  ('DH-0018', '7ft x 4ft', 'Jaisal Fashion Weave', '6304', 12, current_date),
  ('DH-0019', '7ft x 4ft', 'Jaisal Fashion Weave', '6304', 12, current_date),
  ('DH-0020', '7ft x 4ft', 'Jaisal Fashion Weave', '6304', 12, current_date),
  ('DH-0021', '7ft x 4ft', 'Jaisal Fashion Weave', '6304', 12, current_date)
on conflict (dno_number) do nothing;
