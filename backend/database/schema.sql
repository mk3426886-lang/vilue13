-- ============================================================
-- Vilue — database schema (Supabase / PostgreSQL)
-- Run this once in Supabase: Project → SQL Editor → New query → paste → Run
--
-- MVP scope: users, verification_codes, wallets, wallet_transactions.
-- Marketplace / friends / gifts tables are added in a later stage —
-- this file only creates what the current auth + wallet stage needs.
-- ============================================================

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------
-- users
-- ---------------------------------------------------------------
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  display_user_id varchar(12) unique not null,   -- the 12-digit public/login ID shown in-app
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

create index if not exists idx_users_email on users (email);

-- ---------------------------------------------------------------
-- verification_codes
-- One active OTP per user; hashed, never stored in plain text.
-- ---------------------------------------------------------------
create table if not exists verification_codes (
  user_id uuid primary key references users (id) on delete cascade,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Tracks send timestamps for the "5 codes per 15 minutes" + cooldown rules.
create table if not exists verification_code_sends (
  id bigserial primary key,
  user_id uuid not null references users (id) on delete cascade,
  sent_at timestamptz not null default now()
);

create index if not exists idx_vcs_user_time on verification_code_sends (user_id, sent_at);

-- ---------------------------------------------------------------
-- wallets
-- ---------------------------------------------------------------
create table if not exists wallets (
  user_id uuid primary key references users (id) on delete cascade,
  balance_slon bigint not null default 0 check (balance_slon >= 0),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- wallet_transactions
-- Append-only ledger. Balances are derived/verified server-side —
-- the frontend never writes balance_slon directly.
-- ---------------------------------------------------------------
create table if not exists wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  type text not null check (type in ('deposit','withdrawal','transfer_in','transfer_out','fee','gift_sent','gift_received')),
  amount_slon bigint not null check (amount_slon > 0),
  fee_slon bigint not null default 0,
  status text not null default 'pending' check (status in ('pending','processing','approved','completed','rejected','cancelled')),
  counterparty_user_id uuid references users (id),
  reference_id text,                             -- e.g. deposit/withdrawal request id
  meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_wtx_user_time on wallet_transactions (user_id, created_at desc);

-- ---------------------------------------------------------------
-- Row Level Security
--
-- The backend connects with the service_role key, which bypasses RLS
-- by design — so enabling RLS here does not affect the backend's own
-- reads/writes. What it DOES do is block the public/anon key from
-- reading anything, since no policy is defined for it. That's the
-- correct default for now: this project uses its own email/password
-- auth (not Supabase Auth), so there is no Supabase session for
-- auth.uid()-based policies to key off yet. If Supabase Auth is
-- adopted later, add matching "select own row" policies then.
-- ---------------------------------------------------------------
alter table users enable row level security;
alter table wallets enable row level security;
alter table wallet_transactions enable row level security;
