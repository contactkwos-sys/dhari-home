# DHARI Home

Mobile-first inventory & dispatch tracker for home textiles (Flipkart / Amazon / Meesho / etc).

## Stack

- React + Vite + TypeScript
- Tailwind CSS v4
- Supabase (Postgres + Storage + Edge Functions)

## Setup

```bash
npm install
cp .env.example .env   # or use the included .env
npm run dev
```

## Access

PIN gate on first load (Edge Function `pin-login` — PINs never live in frontend code):

| Role | Default PIN | Access |
|------|-------------|--------|
| Owner | `7207` | All tabs + Settings |
| Warehouse | `1122` | Stock + Orders only |

Session is a Supabase Auth session (tokens), not the PIN. Use the header menu → **Logout** to reset a shared device. Owner can change PINs under **Settings**.

## Supabase

Project URL and anon key live in `.env` as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

Migrations & functions:

- `supabase/migrations/` — schema, RLS, size-on-stock, low-stock threshold, role PIN hashes
- `supabase/functions/pin-login` — verify role PIN, return Auth session
- `supabase/functions/pin-reset` — Owner-only PIN change

## Screens

| Tab | Purpose |
|-----|---------|
| Home | Brand hub, low-stock alerts, shortcuts (Owner) |
| DNO | Master list, photo upload, detail view, add/edit (Owner) |
| Stock | Add stock by DNO+size; In/Out/Balance report |
| Orders | Create order (deducts that DNO+size in one RPC) |
| Bill | GST tax invoice (Owner) |
| Settings | Change role PINs (Owner) |
