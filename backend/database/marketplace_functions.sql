-- ============================================================
-- Vilue — marketplace functions (atomic)
-- Run this in Supabase SQL Editor AFTER migration_05.
-- ============================================================

-- ---------------------------------------------------------------
-- create_listing: regular users pay the current listing fee
-- (from platform_settings) up front and go to pending_review.
-- Admin listings (p_is_admin_listing = true) skip the fee and are
-- auto-approved, matching "administrators can publish directly."
-- ---------------------------------------------------------------
create or replace function create_listing(
  p_seller_id uuid,
  p_title text,
  p_description text,
  p_price_slon bigint,
  p_image_url text,
  p_category text,
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
begin
  if p_price_slon <= 0 then
    raise exception 'INVALID_PRICE';
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

  insert into marketplace_products (
    seller_id, created_by_admin, title, description, price_slon, image_url, category,
    listing_fee_slon, status
  ) values (
    case when p_is_admin_listing then null else p_seller_id end,
    p_is_admin_listing, p_title, p_description, p_price_slon, p_image_url, p_category,
    v_fee, case when p_is_admin_listing then 'approved' else 'pending_review' end
  )
  returning * into v_product;

  return v_product;
end;
$$;

-- ---------------------------------------------------------------
-- admin_review_listing: approve publishes it; reject refunds the
-- listing fee (if any) back to the seller.
-- ---------------------------------------------------------------
create or replace function admin_review_listing(
  p_product_id uuid,
  p_action text,
  p_admin_note text default null
) returns marketplace_products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product marketplace_products;
begin
  select * into v_product from marketplace_products where id = p_product_id for update;

  if v_product is null then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  if v_product.status <> 'pending_review' then
    raise exception 'PRODUCT_NOT_PENDING';
  end if;

  if p_action = 'approve' then
    update marketplace_products
      set status = 'approved', admin_note = p_admin_note, updated_at = now()
      where id = p_product_id
      returning * into v_product;

  elsif p_action = 'reject' then
    if v_product.listing_fee_slon > 0 and v_product.seller_id is not null then
      update wallets set balance_slon = balance_slon + v_product.listing_fee_slon, updated_at = now()
        where user_id = v_product.seller_id;
      update platform_wallet set balance_slon = balance_slon - v_product.listing_fee_slon, updated_at = now() where id = true;

      insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, meta)
      values (v_product.seller_id, 'marketplace_fee', v_product.listing_fee_slon, 0, 'cancelled', jsonb_build_object('reason', 'listing_fee_refund'));
    end if;

    update marketplace_products
      set status = 'rejected', admin_note = p_admin_note, updated_at = now()
      where id = p_product_id
      returning * into v_product;
  else
    raise exception 'INVALID_ACTION';
  end if;

  return v_product;
end;
$$;

-- ---------------------------------------------------------------
-- purchase_product: atomic buy. Commission (from platform_settings)
-- is taken from the sale; a platform-listed product (no seller) pays
-- its full price to the platform wallet.
-- ---------------------------------------------------------------
create or replace function purchase_product(
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
  v_commission_percent numeric;
  v_commission bigint;
  v_seller_net bigint;
  v_order marketplace_orders;
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

  select balance_slon into v_buyer_balance from wallets where user_id = p_buyer_id for update;
  if v_buyer_balance is null then
    raise exception 'WALLET_NOT_FOUND';
  end if;
  if v_buyer_balance < v_product.price_slon then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  select marketplace_commission_percent into v_commission_percent from platform_settings where id = true;
  v_commission := floor(v_product.price_slon * coalesce(v_commission_percent, 0) / 100.0);
  v_seller_net := v_product.price_slon - v_commission;

  update wallets set balance_slon = balance_slon - v_product.price_slon, updated_at = now()
    where user_id = p_buyer_id;

  if v_product.seller_id is not null then
    perform 1 from wallets where user_id = v_product.seller_id for update;
    update wallets set balance_slon = balance_slon + v_seller_net, updated_at = now()
      where user_id = v_product.seller_id;
    update platform_wallet set balance_slon = balance_slon + v_commission, updated_at = now() where id = true;
  else
    -- Platform-owned listing: the full price goes to the platform wallet.
    update platform_wallet set balance_slon = balance_slon + v_product.price_slon, updated_at = now() where id = true;
  end if;

  update marketplace_products set status = 'sold', updated_at = now() where id = p_product_id;

  insert into marketplace_orders (product_id, buyer_id, seller_id, price_slon, commission_slon)
  values (p_product_id, p_buyer_id, v_product.seller_id, v_product.price_slon, v_commission)
  returning * into v_order;

  insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, counterparty_user_id, reference_id)
  values (p_buyer_id, 'purchase', v_product.price_slon, 0, 'completed', v_product.seller_id, v_product.id::text);

  if v_product.seller_id is not null then
    insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, counterparty_user_id, reference_id)
    values (v_product.seller_id, 'sale', v_seller_net, v_commission, 'completed', p_buyer_id, v_product.id::text);
  end if;

  return v_order;
end;
$$;
