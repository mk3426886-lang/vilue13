-- ============================================================
-- Vilue — migration 04: owner hierarchy, verification badges,
-- configurable platform settings (fees/rates), platform wallet
-- Run this in Supabase SQL Editor (New snippet -> paste -> Run)
-- ============================================================

-- ---- Owner + verification badges ----
alter table users add column if not exists is_owner boolean not null default false;
-- verification_badge: null | 'verified' | 'admin' | 'owner'
alter table users add column if not exists verification_badge text;

-- ---- Platform settings: single row, admin-editable ----
create table if not exists platform_settings (
  id boolean primary key default true check (id),
  slon_per_iqd numeric not null default 5,              -- 5 SLON = 1 IQD
  usdt_to_iqd numeric not null default 1320,
  withdrawal_fee_percent numeric not null default 0,
  transfer_fee_percent numeric not null default 0,
  deposit_fee_percent numeric not null default 0,
  gift_commission_percent numeric not null default 5,
  marketplace_listing_fee_slon bigint not null default 100,
  marketplace_commission_percent numeric not null default 0,
  updated_at timestamptz not null default now()
);
insert into platform_settings (id) values (true) on conflict (id) do nothing;

-- ---- Platform wallet: collects fees from deposits/withdrawals/transfers ----
create table if not exists platform_wallet (
  id boolean primary key default true check (id),
  balance_slon bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into platform_wallet (id) values (true) on conflict (id) do nothing;

alter table platform_settings enable row level security;
alter table platform_wallet enable row level security;
-- No public policies defined — only the backend's service_role key
-- (which bypasses RLS) can read/write these, same as other tables.

-- ---- Bootstrap: make your own account the owner ----
-- Run this as its own query, once, after registering normally:
-- update users set is_admin = true, is_owner = true, verification_badge = 'owner'
--   where email = 'your.email@example.com';
-- Then log out and back in on that account (the JWT carries isOwner/isAdmin
-- at login time, so an existing session won't see the change).
