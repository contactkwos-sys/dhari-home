-- Fix DNO edit RLS + move size from dno_master onto stock_movements & orders

-- ─── 1) Explicit RLS policies (SELECT/INSERT/UPDATE/DELETE) ─────────
drop policy if exists "anon_all_dno_master" on public.dno_master;
drop policy if exists "dno_master_select" on public.dno_master;
drop policy if exists "dno_master_insert" on public.dno_master;
drop policy if exists "dno_master_update" on public.dno_master;
drop policy if exists "dno_master_delete" on public.dno_master;

create policy "dno_master_select" on public.dno_master
  for select to anon, authenticated using (true);
create policy "dno_master_insert" on public.dno_master
  for insert to anon, authenticated with check (true);
create policy "dno_master_update" on public.dno_master
  for update to anon, authenticated using (true) with check (true);
create policy "dno_master_delete" on public.dno_master
  for delete to anon, authenticated using (true);

grant select, insert, update, delete on public.dno_master to anon, authenticated, service_role;

drop policy if exists "anon_all_stock_movements" on public.stock_movements;
drop policy if exists "stock_movements_select" on public.stock_movements;
drop policy if exists "stock_movements_insert" on public.stock_movements;
drop policy if exists "stock_movements_update" on public.stock_movements;
drop policy if exists "stock_movements_delete" on public.stock_movements;

create policy "stock_movements_select" on public.stock_movements
  for select to anon, authenticated using (true);
create policy "stock_movements_insert" on public.stock_movements
  for insert to anon, authenticated with check (true);
create policy "stock_movements_update" on public.stock_movements
  for update to anon, authenticated using (true) with check (true);
create policy "stock_movements_delete" on public.stock_movements
  for delete to anon, authenticated using (true);

grant select, insert, update, delete on public.stock_movements to anon, authenticated, service_role;

drop policy if exists "anon_all_orders" on public.orders;
drop policy if exists "orders_select" on public.orders;
drop policy if exists "orders_insert" on public.orders;
drop policy if exists "orders_update" on public.orders;
drop policy if exists "orders_delete" on public.orders;

create policy "orders_select" on public.orders
  for select to anon, authenticated using (true);
create policy "orders_insert" on public.orders
  for insert to anon, authenticated with check (true);
create policy "orders_update" on public.orders
  for update to anon, authenticated using (true) with check (true);
create policy "orders_delete" on public.orders
  for delete to anon, authenticated using (true);

grant select, insert, update, delete on public.orders to anon, authenticated, service_role;

-- ─── 2) Size enum-like check on movements & orders ────────────
alter table public.stock_movements
  add column if not exists size text;

alter table public.orders
  add column if not exists size text;

-- Backfill from dno_master.size for existing rows
update public.stock_movements sm
set size = d.size
from public.dno_master d
where sm.dno_id = d.id
  and (sm.size is null or sm.size = '');

update public.orders o
set size = d.size
from public.dno_master d
where o.dno_id = d.id
  and (o.size is null or o.size = '');

-- Default any stragglers
update public.stock_movements set size = '5ft x 4ft' where size is null;
update public.orders set size = '5ft x 4ft' where size is null;

alter table public.stock_movements
  alter column size set not null;

alter table public.orders
  alter column size set not null;

alter table public.stock_movements
  drop constraint if exists stock_movements_size_check;
alter table public.stock_movements
  add constraint stock_movements_size_check
  check (size in ('5ft x 4ft', '7ft x 4ft'));

alter table public.orders
  drop constraint if exists orders_size_check;
alter table public.orders
  add constraint orders_size_check
  check (size in ('5ft x 4ft', '7ft x 4ft'));

create index if not exists stock_movements_dno_size_idx
  on public.stock_movements(dno_id, size);

-- ─── 3) Drop size from dno_master ─────────────────────────────
alter table public.dno_master drop column if exists size;

-- ─── 4) Size-aware stock balance + order RPC ──────────────────
create or replace function public.dno_size_stock_balance(p_dno_id uuid, p_size text)
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
  where dno_id = p_dno_id and size = p_size;
$$;

-- Keep old helper for compatibility (sums all sizes)
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

drop function if exists public.create_order_with_stock(
  date, uuid, text, text, integer, numeric, text, text, text, text, text, text
);

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
  p_invoice_no text,
  p_size text
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

  if p_size is null or p_size not in ('5ft x 4ft', '7ft x 4ft') then
    raise exception 'Size must be 5ft x 4ft or 7ft x 4ft';
  end if;

  select public.dno_size_stock_balance(p_dno_id, p_size) into v_balance;
  if v_balance < p_pieces then
    raise exception 'Insufficient stock for %: available %, requested %',
      p_size, v_balance, p_pieces;
  end if;

  insert into public.orders (
    order_date, dno_id, platform, platform_order_id, pieces, sale_rate,
    buyer_name, buyer_state, courier, awb_number, payment_status, invoice_no, size
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
    p_invoice_no,
    p_size
  )
  returning * into v_order;

  insert into public.stock_movements (dno_id, type, qty, date, note, size)
  values (
    p_dno_id,
    'OUT',
    p_pieces,
    coalesce(p_order_date, current_date),
    'Order ' || coalesce(v_order.platform_order_id, v_order.id::text),
    p_size
  );

  return v_order;
end;
$$;

grant execute on function public.dno_size_stock_balance(uuid, text)
  to anon, authenticated, service_role;
grant execute on function public.dno_stock_balance(uuid)
  to anon, authenticated, service_role;
grant execute on function public.create_order_with_stock(
  date, uuid, text, text, integer, numeric, text, text, text, text, text, text, text
) to anon, authenticated, service_role;
