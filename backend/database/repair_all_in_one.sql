-- ============================================================
-- Vilue — REPAIR ALL (one-shot, idempotent)
-- Safe to run no matter what's already been applied — every
-- statement either creates-if-missing or updates-if-different.
-- Paste this WHOLE file into Supabase SQL Editor -> New snippet -> Run.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------
-- users — ensure every required column exists with the right type
-- ---------------------------------------------------------------
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  display_user_id varchar(12) unique not null,
  name text not null,
  email text unique not null,
  password_hash text not null,
  country text not null default 'IQ',
  governorate text not null,
  language text not null default 'ar',
  is_verified boolean not null default false,
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If the table already existed from before, make sure every later
-- column is present and display_user_id is wide enough.
alter table users add column if not exists is_admin boolean not null default false;
alter table users add column if not exists is_owner boolean not null default false;
alter table users add column if not exists two_fa_enabled boolean not null default false;
alter table users add column if not exists verification_badge text;
alter table users alter column display_user_id type varchar(12);
alter table users drop column if exists username;

create index if not exists idx_users_email on users (email);

-- ---------------------------------------------------------------
-- verification_codes / verification_code_sends
-- ---------------------------------------------------------------
create table if not exists verification_codes (
  user_id uuid primary key references users (id) on delete cascade,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists verification_code_sends (
  id bigserial primary key,
  user_id uuid not null references users (id) on delete cascade,
  sent_at timestamptz not null default now()
);
create index if not exists idx_vcs_user_time on verification_code_sends (user_id, sent_at);

-- ---------------------------------------------------------------
-- wallets / wallet_transactions
-- ---------------------------------------------------------------
create table if not exists wallets (
  user_id uuid primary key references users (id) on delete cascade,
  balance_slon bigint not null default 0 check (balance_slon >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  type text not null,
  amount_slon bigint not null check (amount_slon > 0),
  fee_slon bigint not null default 0,
  status text not null default 'pending',
  counterparty_user_id uuid references users (id),
  reference_id text,
  meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_wtx_user_time on wallet_transactions (user_id, created_at desc);

alter table wallet_transactions drop constraint if exists wallet_transactions_type_check;
alter table wallet_transactions add constraint wallet_transactions_type_check
  check (type in (
    'deposit','withdrawal','transfer_in','transfer_out','fee',
    'gift_sent','gift_received','purchase','sale','marketplace_fee'
  ));

alter table wallet_transactions drop constraint if exists wallet_transactions_status_check;
alter table wallet_transactions add constraint wallet_transactions_status_check
  check (status in ('pending','processing','approved','completed','rejected','cancelled'));

-- ---------------------------------------------------------------
-- platform_settings / platform_wallet
-- ---------------------------------------------------------------
create table if not exists platform_settings (
  id boolean primary key default true check (id),
  slon_per_iqd numeric not null default 5,
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

create table if not exists platform_wallet (
  id boolean primary key default true check (id),
  balance_slon bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into platform_wallet (id) values (true) on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- marketplace_products / marketplace_orders
-- ---------------------------------------------------------------
create table if not exists marketplace_products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references users (id) on delete set null,
  created_by_admin boolean not null default false,
  title text not null,
  description text,
  price_slon bigint not null check (price_slon > 0),
  image_url text,
  category text,
  listing_fee_slon bigint not null default 0,
  status text not null default 'pending_review'
    check (status in ('pending_review','approved','rejected','sold','hidden')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_products_status on marketplace_products (status);
create index if not exists idx_products_seller on marketplace_products (seller_id);

create table if not exists marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references marketplace_products (id),
  buyer_id uuid not null references users (id),
  seller_id uuid references users (id),
  price_slon bigint not null,
  commission_slon bigint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_orders_buyer on marketplace_orders (buyer_id);
create index if not exists idx_orders_seller on marketplace_orders (seller_id);

-- ---------------------------------------------------------------
-- RLS: enabled with no public policies (service_role bypasses this,
-- so the backend is unaffected; the anon key gets nothing).
-- ---------------------------------------------------------------
alter table users enable row level security;
alter table wallets enable row level security;
alter table wallet_transactions enable row level security;
alter table platform_settings enable row level security;
alter table platform_wallet enable row level security;
alter table marketplace_products enable row level security;
alter table marketplace_orders enable row level security;

-- ---------------------------------------------------------------
-- Cleanup: if a stray "listings" table got created by accident while
-- troubleshooting, it is NOT used by this app (our table is
-- marketplace_products) and is safe to ignore or drop:
-- drop table if exists public.listings cascade;
-- ---------------------------------------------------------------

-- ---------------------------------------------------------------
-- Make your account the owner (EDIT THE EMAIL, then run this
-- statement — it's already safe/idempotent on its own):
-- ---------------------------------------------------------------
update users set is_admin = true, is_owner = true, verification_badge = 'owner'
  where email = 'mk3428668@gmail.com';

select id, display_user_id, email, is_admin, is_owner, verification_badge
from users where email = 'mk3428668@gmail.com';
