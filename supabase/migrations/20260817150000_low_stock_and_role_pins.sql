-- Low stock thresholds + role PIN storage for DHARI Home

-- ─── 1) low_stock_threshold on dno_master ─────────────────────
alter table public.dno_master
  add column if not exists low_stock_threshold integer not null default 10
  check (low_stock_threshold >= 0);

-- ─── 2) Role PIN table (hashes only — never plaintext) ────────
create table if not exists public.app_role_pins (
  role text primary key check (role in ('Owner', 'Warehouse')),
  pin_hash text not null,
  auth_user_id uuid,
  updated_at timestamptz not null default now()
);

alter table public.app_role_pins enable row level security;

-- No direct client read/write of pin hashes — Edge Functions use service role
drop policy if exists "app_role_pins_deny_all" on public.app_role_pins;
-- Intentionally no policies for anon/authenticated → RLS blocks them

revoke all on public.app_role_pins from anon, authenticated;
grant all on public.app_role_pins to service_role;

-- Seed default PIN hashes (Owner 7207, Warehouse 1122).
-- Hashes generated with pbkdf2-sha256 100000 iterations (same as pin-login).
insert into public.app_role_pins (role, pin_hash)
values
  (
    'Owner',
    'pbkdf2$sha256$100000$MkI4qEjQ82/gGJlpWSn6CA==$W+7v5mM0I56rWOpDimhDLOpJdugVKAeXYaQHLTC8o5M='
  ),
  (
    'Warehouse',
    'pbkdf2$sha256$100000$Y3lR+TUP4F19jnSehUT14w==$BqwgU6NQXgXc1E8+Ohkfqb7p3HmMkzCL2RsNDaQcLQM='
  )
on conflict (role) do nothing;
