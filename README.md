# DHARI Home

Mobile-first inventory & dispatch tracker for home textiles (Flipkart / Amazon / Meesho / etc).

## Stack

- React + Vite + TypeScript
- Tailwind CSS v4
- Supabase (Postgres + Storage)

## Setup

```bash
npm install
cp .env.example .env   # or use the included .env
npm run dev
```

## Supabase

Project URL and anon key live in `.env` as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

Schema, RLS, storage bucket `dno-photos`, seed DNOs (`DH-0001`–`DH-0021`), and the `create_order_with_stock` RPC are in:

`supabase/migrations/20260317120000_init.sql`

## Screens

| Tab | Purpose |
|-----|---------|
| Home | Brand hub + shortcuts |
| DNO | Master list, photo upload, add/edit |
| Stock | In/Out/Balance + movement ledger |
| Orders | Create order (deducts stock in one transaction) |
| Bill | GST tax invoice (CGST+SGST for Gujarat, else IGST) |
