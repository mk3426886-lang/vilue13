-- ============================================================
-- Vilue — wallet functions v3 (percent-or-fixed fees)
-- Run in Supabase SQL Editor AFTER migration_06_fee_types.sql.
-- Overwrites request_deposit / request_withdrawal / transfer_slon
-- to use compute_fee() with the new *_type / *_value columns.
-- ============================================================

create or replace function request_deposit(
  p_user_id uuid,
  p_amount_slon bigint,
  p_method text,
  p_meta jsonb
) returns wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_value numeric;
  v_fee bigint;
  v_tx wallet_transactions;
begin
  if p_amount_slon <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  select deposit_fee_type, deposit_fee_value into v_type, v_value from platform_settings where id = true;
  v_fee := compute_fee(p_amount_slon, v_type, v_value);

  insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, meta)
  values (p_user_id, 'deposit', p_amount_slon, v_fee, 'pending', p_meta || jsonb_build_object('method', p_method))
  returning * into v_tx;

  return v_tx;
end;
$$;

create or replace function request_withdrawal(
  p_user_id uuid,
  p_amount_slon bigint,
  p_method text,
  p_meta jsonb
) returns wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
  v_type text;
  v_value numeric;
  v_fee bigint;
  v_tx wallet_transactions;
begin
  if p_amount_slon <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  select balance_slon into v_balance from wallets where user_id = p_user_id for update;
  if v_balance is null then
    raise exception 'WALLET_NOT_FOUND';
  end if;
  if v_balance < p_amount_slon then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  select withdrawal_fee_type, withdrawal_fee_value into v_type, v_value from platform_settings where id = true;
  v_fee := compute_fee(p_amount_slon, v_type, v_value);

  update wallets set balance_slon = balance_slon - p_amount_slon, updated_at = now()
    where user_id = p_user_id;

  insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, meta)
  values (
    p_user_id, 'withdrawal', p_amount_slon, v_fee, 'pending',
    p_meta || jsonb_build_object('method', p_method, 'cancel_until', (now() + interval '15 minutes'))
  )
  returning * into v_tx;

  return v_tx;
end;
$$;

create or replace function transfer_slon(
  p_sender_id uuid,
  p_receiver_display_id text,
  p_amount_slon bigint
) returns wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_balance bigint;
  v_receiver_id uuid;
  v_type text;
  v_value numeric;
  v_fee bigint;
  v_net bigint;
  v_tx wallet_transactions;
begin
  if p_amount_slon <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  select id into v_receiver_id from users where display_user_id = p_receiver_display_id;
  if v_receiver_id is null then
    raise exception 'RECEIVER_NOT_FOUND';
  end if;
  if v_receiver_id = p_sender_id then
    raise exception 'CANNOT_TRANSFER_TO_SELF';
  end if;

  select balance_slon into v_sender_balance from wallets where user_id = p_sender_id for update;
  if v_sender_balance is null then
    raise exception 'WALLET_NOT_FOUND';
  end if;
  if v_sender_balance < p_amount_slon then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  perform 1 from wallets where user_id = v_receiver_id for update;

  select transfer_fee_type, transfer_fee_value into v_type, v_value from platform_settings where id = true;
  v_fee := compute_fee(p_amount_slon, v_type, v_value);
  v_net := p_amount_slon - v_fee;

  update wallets set balance_slon = balance_slon - p_amount_slon, updated_at = now()
    where user_id = p_sender_id;
  update wallets set balance_slon = balance_slon + v_net, updated_at = now()
    where user_id = v_receiver_id;

  if v_fee > 0 then
    update platform_wallet set balance_slon = balance_slon + v_fee, updated_at = now() where id = true;
  end if;

  insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, counterparty_user_id)
  values (p_sender_id, 'transfer_out', p_amount_slon, v_fee, 'completed', v_receiver_id)
  returning * into v_tx;

  insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, counterparty_user_id)
  values (v_receiver_id, 'transfer_in', v_net, 0, 'completed', p_sender_id);

  return v_tx;
end;
$$;
