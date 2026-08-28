-- ============================================================
-- Vilue — marketplace functions v2 (percent-or-fixed commission)
-- Run in Supabase SQL Editor AFTER migration_06_fee_types.sql.
-- ============================================================

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
  v_type text;
  v_value numeric;
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
