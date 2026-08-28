-- ============================================================
-- Vilue — migration 05: marketplace
-- Run this in Supabase SQL Editor (New snippet -> paste -> Run)
-- ============================================================

-- Allow the new transaction types the marketplace needs.
alter table wallet_transactions drop constraint if exists wallet_transactions_type_check;
alter table wallet_transactions add constraint wallet_transactions_type_check
  check (type in (
    'deposit','withdrawal','transfer_in','transfer_out','fee',
    'gift_sent','gift_received','purchase','sale','marketplace_fee'
  ));

-- ---------------------------------------------------------------
-- marketplace_products
-- ---------------------------------------------------------------
create table if not exists marketplace_products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references users (id) on delete set null,   -- null = platform/admin listing
  created_by_admin boolean not null default false,
  title text not null,
  description text,
  price_slon bigint not null check (price_slon > 0),
  image_url text,
  category text,
  listing_fee_slon bigint not null default 0,   -- fee charged/held at listing time (refunded if rejected)
  status text not null default 'pending_review'
    check (status in ('pending_review','approved','rejected','sold','hidden')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_status on marketplace_products (status);
create index if not exists idx_products_seller on marketplace_products (seller_id);

-- ---------------------------------------------------------------
-- marketplace_orders — a record of each completed purchase
-- ---------------------------------------------------------------
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

alter table marketplace_products enable row level security;
alter table marketplace_orders enable row level security;
-- No public policies — backend's service_role key only, same pattern as
-- every other table (RLS blocks the anon key by default with no policy).
