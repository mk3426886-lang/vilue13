-- ============================================================
-- Vilue — marketplace functions v3 (quantity + credit-code products)
-- Run in Supabase SQL Editor AFTER migration_07_marketplace_quantity.sql.
-- These are NEW function names (create_listing_v2, purchase_product_v2)
-- so nothing that calls the old create_listing/purchase_product breaks —
-- the backend now calls these v2 versions instead.
-- ============================================================

-- ---------------------------------------------------------------
-- create_listing_v2 — same fee/approval logic as create_listing,
-- plus quantity (NULL = unlimited) and product_type.
-- ---------------------------------------------------------------
create or replace function create_listing_v2(
  p_seller_id uuid,
  p_title text,
  p_description text,
  p_price_slon bigint,
  p_image_url text,
  p_category text,
  p_quantity integer default null,       -- NULL = unlimited
  p_product_type text default 'item',    -- 'item' | 'credit_code'
  p_delivery_content text default null,
  p_is_admin_listing boolean default false
) returns marketplace_products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee bigint := 0;
  v_balance bigint;
  v_product marketplace_products;
  v_initial_quantity integer;
begin
  if p_price_slon <= 0 then
    raise exception 'INVALID_PRICE';
  end if;
  if p_product_type not in ('item', 'credit_code') then
    raise exception 'INVALID_PRODUCT_TYPE';
  end if;

  if not p_is_admin_listing then
    select marketplace_listing_fee_slon into v_fee from platform_settings where id = true;
    v_fee := coalesce(v_fee, 0);

    if v_fee > 0 then
      select balance_slon into v_balance from wallets where user_id = p_seller_id for update;
      if v_balance is null then
        raise exception 'WALLET_NOT_FOUND';
      end if;
      if v_balance < v_fee then
        raise exception 'INSUFFICIENT_BALANCE';
      end if;

      update wallets set balance_slon = balance_slon - v_fee, updated_at = now()
        where user_id = p_seller_id;
      update platform_wallet set balance_slon = balance_slon + v_fee, updated_at = now() where id = true;

      insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, meta)
      values (p_seller_id, 'marketplace_fee', v_fee, 0, 'completed', jsonb_build_object('reason', 'listing_fee'));
    end if;
  end if;

  -- credit_code listings start at 0 remaining — add_product_codes()
  -- raises this once the seller uploads their code pool.
  v_initial_quantity := case when p_product_type = 'credit_code' then 0 else p_quantity end;

  insert into marketplace_products (
    seller_id, created_by_admin, title, description, price_slon, image_url, category,
    listing_fee_slon, status, quantity, product_type, delivery_content
  ) values (
    case when p_is_admin_listing then null else p_seller_id end,
    p_is_admin_listing, p_title, p_description, p_price_slon, p_image_url, p_category,
    v_fee, case when p_is_admin_listing then 'approved' else 'pending_review' end,
    v_initial_quantity, p_product_type, p_delivery_content
  )
  returning * into v_product;

  return v_product;
end;
$$;

-- ---------------------------------------------------------------
-- add_product_codes — seller (or admin) uploads a batch of codes for
-- a credit_code listing. quantity is recalculated from the real
-- unused-code count, never incremented blindly, so it can't drift.
-- ---------------------------------------------------------------
create or replace function add_product_codes(
  p_product_id uuid,
  p_seller_id uuid,
  p_codes text[],
  p_is_admin boolean default false
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product marketplace_products;
  v_inserted integer;
  v_remaining integer;
begin
  select * into v_product from marketplace_products where id = p_product_id for update;
  if v_product is null then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  if not p_is_admin and v_product.seller_id is distinct from p_seller_id then
    raise exception 'NOT_OWNER';
  end if;
  if v_product.product_type <> 'credit_code' then
    raise exception 'NOT_CREDIT_CODE_PRODUCT';
  end if;
  if p_codes is null or array_length(p_codes, 1) is null then
    raise exception 'NO_CODES_PROVIDED';
  end if;

  insert into marketplace_product_codes (product_id, code)
  select p_product_id, trim(c) from unnest(p_codes) as c where trim(c) <> '';
  get diagnostics v_inserted = row_count;

  select count(*) into v_remaining from marketplace_product_codes
    where product_id = p_product_id and is_used = false;

  update marketplace_products
    set quantity = v_remaining, updated_at = now()
    where id = p_product_id;

  return v_inserted;
end;
$$;

-- ---------------------------------------------------------------
-- purchase_product_v2 — same money-movement logic as purchase_product,
-- plus: stock check (quantity NULL = unlimited, never decremented),
-- and atomic credit-code claiming for credit_code products.
-- ---------------------------------------------------------------
create or replace function purchase_product_v2(
  p_buyer_id uuid,
  p_product_id uuid
) returns marketplace_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product marketplace_products;
  v_buyer_balance bigint;
  v_type text;
  v_value numeric;
  v_commission bigint;
  v_seller_net bigint;
  v_order marketplace_orders;
  v_code_id uuid;
  v_code_value text;
  v_remaining integer;
begin
  select * into v_product from marketplace_products where id = p_product_id for update;

  if v_product is null then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  if v_product.status <> 'approved' then
    raise exception 'PRODUCT_NOT_AVAILABLE';
  end if;
  if v_product.seller_id = p_buyer_id then
    raise exception 'CANNOT_BUY_OWN_LISTING';
  end if;
  -- NULL quantity = unlimited, never blocks. A number <= 0 means sold out.
  if v_product.quantity is not null and v_product.quantity <= 0 then
    raise exception 'OUT_OF_STOCK';
  end if;

  select balance_slon into v_buyer_balance from wallets where user_id = p_buyer_id for update;
  if v_buyer_balance is null then
    raise exception 'WALLET_NOT_FOUND';
  end if;
  if v_buyer_balance < v_product.price_slon then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  -- Credit-code products: reserve one unused code BEFORE moving any
  -- money, so a race between two buyers can never charge someone for
  -- a code that doesn't exist. skip locked lets a concurrent buyer
  -- move on to the next unused row instead of blocking.
  if v_product.product_type = 'credit_code' then
    select id, code into v_code_id, v_code_value
      from marketplace_product_codes
      where product_id = p_product_id and is_used = false
      order by created_at asc
      limit 1
      for update skip locked;

    if v_code_id is null then
      raise exception 'OUT_OF_STOCK';
    end if;
  end if;

  select marketplace_commission_type, marketplace_commission_value into v_type, v_value from platform_settings where id = true;
  v_commission := compute_fee(v_product.price_slon, v_type, v_value);
  if v_commission > v_product.price_slon then
    v_commission := v_product.price_slon;
  end if;
  v_seller_net := v_product.price_slon - v_commission;

  update wallets set balance_slon = balance_slon - v_product.price_slon, updated_at = now()
    where user_id = p_buyer_id;

  if v_product.seller_id is not null then
    perform 1 from wallets where user_id = v_product.seller_id for update;
    update wallets set balance_slon = balance_slon + v_seller_net, updated_at = now()
      where user_id = v_product.seller_id;
    update platform_wallet set balance_slon = balance_slon + v_commission, updated_at = now() where id = true;
  else
    update platform_wallet set balance_slon = balance_slon + v_product.price_slon, updated_at = now() where id = true;
  end if;

  insert into marketplace_orders (product_id, buyer_id, seller_id, price_slon, commission_slon, code_value)
  values (p_product_id, p_buyer_id, v_product.seller_id, v_product.price_slon, v_commission,
    coalesce(v_code_value, v_product.delivery_content))
  returning * into v_order;

  if v_product.product_type = 'credit_code' then
    update marketplace_product_codes set is_used = true, used_by_order_id = v_order.id where id = v_code_id;
    select count(*) into v_remaining from marketplace_product_codes
      where product_id = p_product_id and is_used = false;
    update marketplace_products set quantity = v_remaining,
      status = case when v_remaining <= 0 then 'sold' else status end,
      updated_at = now()
      where id = p_product_id;
  elsif v_product.quantity is not null then
    v_remaining := v_product.quantity - 1;
    update marketplace_products set quantity = v_remaining,
      status = case when v_remaining <= 0 then 'sold' else status end,
      updated_at = now()
      where id = p_product_id;
  end if;
  -- quantity is null (unlimited item): never touched, listing stays approved forever.

  insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, counterparty_user_id, reference_id)
  values (p_buyer_id, 'purchase', v_product.price_slon, 0, 'completed', v_product.seller_id, v_product.id::text);

  if v_product.seller_id is not null then
    insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, counterparty_user_id, reference_id)
    values (v_product.seller_id, 'sale', v_seller_net, v_commission, 'completed', p_buyer_id, v_product.id::text);
  end if;

  return v_order;
end;
$$;
