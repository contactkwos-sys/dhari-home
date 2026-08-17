-- Reaffirm INSERT/UPDATE RLS for dno_master & stock_movements
-- (idempotent — safe if already applied)

drop policy if exists "dno_master_select" on public.dno_master;
drop policy if exists "dno_master_insert" on public.dno_master;
drop policy if exists "dno_master_update" on public.dno_master;
drop policy if exists "dno_master_delete" on public.dno_master;
drop policy if exists "anon_all_dno_master" on public.dno_master;

create policy "dno_master_select" on public.dno_master
  for select to anon, authenticated using (true);
create policy "dno_master_insert" on public.dno_master
  for insert to anon, authenticated with check (true);
create policy "dno_master_update" on public.dno_master
  for update to anon, authenticated using (true) with check (true);
create policy "dno_master_delete" on public.dno_master
  for delete to anon, authenticated using (true);

grant select, insert, update, delete on public.dno_master to anon, authenticated, service_role;

drop policy if exists "stock_movements_select" on public.stock_movements;
drop policy if exists "stock_movements_insert" on public.stock_movements;
drop policy if exists "stock_movements_update" on public.stock_movements;
drop policy if exists "stock_movements_delete" on public.stock_movements;
drop policy if exists "anon_all_stock_movements" on public.stock_movements;

create policy "stock_movements_select" on public.stock_movements
  for select to anon, authenticated using (true);
create policy "stock_movements_insert" on public.stock_movements
  for insert to anon, authenticated with check (true);
create policy "stock_movements_update" on public.stock_movements
  for update to anon, authenticated using (true) with check (true);
create policy "stock_movements_delete" on public.stock_movements
  for delete to anon, authenticated using (true);

grant select, insert, update, delete on public.stock_movements to anon, authenticated, service_role;

-- Ensure size column exists and is required on stock_movements
alter table public.stock_movements
  add column if not exists size text;

update public.stock_movements set size = '5ft x 4ft' where size is null;

alter table public.stock_movements
  alter column size set not null;

alter table public.stock_movements
  drop constraint if exists stock_movements_size_check;
alter table public.stock_movements
  add constraint stock_movements_size_check
  check (size in ('5ft x 4ft', '7ft x 4ft'));

-- Optional RPC used as a reliable stock-in path (security definer)
create or replace function public.add_stock_in(
  p_dno_id uuid,
  p_size text,
  p_qty integer,
  p_date date default current_date,
  p_note text default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.stock_movements;
begin
  if p_dno_id is null then
    raise exception 'DNO is required';
  end if;
  if p_size is null or p_size not in ('5ft x 4ft', '7ft x 4ft') then
    raise exception 'Size must be 5ft x 4ft or 7ft x 4ft';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantity must be greater than 0';
  end if;

  insert into public.stock_movements (dno_id, size, type, qty, date, note)
  values (
    p_dno_id,
    p_size,
    'IN',
    p_qty,
    coalesce(p_date, current_date),
    p_note
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.add_stock_in(uuid, text, integer, date, text)
  to anon, authenticated, service_role;
