-- ============================================================
-- Vilue — migration 07: marketplace quantity + credit-code products
-- Run this in Supabase SQL Editor AFTER migration_06_fee_types.sql
-- and marketplace_functions_v2.sql.
-- ============================================================

-- quantity is NULL = unlimited stock (the "0" a seller types in the
-- create-listing form is translated to NULL by the backend before
-- insert — see marketplace.controller.js). A positive integer is a
-- real remaining-stock count that decrements on every purchase; when
-- it hits 0 the listing is marked 'sold' and can't be bought again.
alter table marketplace_products add column if not exists quantity integer;
alter table marketplace_products add column if not exists product_type text not null default 'item'
  check (product_type in ('item', 'credit_code'));
alter table marketplace_products add column if not exists delivery_content text;

-- ---------------------------------------------------------------
-- marketplace_product_codes — pool of one-time codes for a
-- 'credit_code' product. Each purchase atomically claims exactly one
-- unused row. quantity on the parent product is kept as a synced
-- cache of "how many unused codes remain" for fast display.
-- ---------------------------------------------------------------
create table if not exists marketplace_product_codes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references marketplace_products (id) on delete cascade,
  code text not null,
  is_used boolean not null default false,
  used_by_order_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_codes_unused
  on marketplace_product_codes (product_id) where is_used = false;

alter table marketplace_product_codes enable row level security;
-- No public policies — backend's service_role key only.

-- The specific code a buyer received (credit_code products) or a
-- reminder of the seller's delivery_content at the time of purchase
-- (regular digital items) — shown on the buyer's purchase detail.
alter table marketplace_orders add column if not exists code_value text;
