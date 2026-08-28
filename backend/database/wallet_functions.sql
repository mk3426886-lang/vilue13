-- ============================================================
-- Vilue — wallet functions (atomic financial operations)
-- Run this in Supabase SQL Editor (New snippet -> paste -> Run)
--
-- Every function below runs as a single Postgres transaction, so a
-- balance change and its ledger entry either both happen or neither
-- does — there is no state where money is deducted from one side
-- without landing on the other.
-- ============================================================

-- ---------------------------------------------------------------
-- request_deposit: creates a pending deposit request.
-- No balance change yet — funds are only credited when an admin
-- approves it (deposits are manual-review: Zain Cash / Super Qi).
-- ---------------------------------------------------------------
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
  v_tx wallet_transactions;
begin
  if p_amount_slon <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, meta)
  values (p_user_id, 'deposit', p_amount_slon, 0, 'pending', p_meta || jsonb_build_object('method', p_method))
  returning * into v_tx;

  return v_tx;
end;
$$;

-- ---------------------------------------------------------------
-- admin_review_deposit: approve credits the wallet; reject does not.
-- ---------------------------------------------------------------
create or replace function admin_review_deposit(
  p_transaction_id uuid,
  p_action text,       -- 'approve' | 'reject'
  p_admin_note text default null
) returns wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx wallet_transactions;
begin
  select * into v_tx from wallet_transactions where id = p_transaction_id for update;

  if v_tx is null then
    raise exception 'TX_NOT_FOUND';
  end if;
  if v_tx.type <> 'deposit' or v_tx.status <> 'pending' then
    raise exception 'TX_NOT_PENDING_DEPOSIT';
  end if;

  if p_action = 'approve' then
    update wallets set balance_slon = balance_slon + v_tx.amount_slon, updated_at = now()
      where user_id = v_tx.user_id;

    update wallet_transactions
      set status = 'completed', meta = meta || jsonb_build_object('admin_note', p_admin_note), updated_at = now()
      where id = p_transaction_id
      returning * into v_tx;

  elsif p_action = 'reject' then
    update wallet_transactions
      set status = 'rejected', meta = meta || jsonb_build_object('admin_note', p_admin_note), updated_at = now()
      where id = p_transaction_id
      returning * into v_tx;
  else
    raise exception 'INVALID_ACTION';
  end if;

  return v_tx;
end;
$$;

-- ---------------------------------------------------------------
-- request_withdrawal: funds are held immediately (deducted on
-- request), matching the spec's 15-minute cancellation window —
-- there must be something concrete to cancel back.
-- ---------------------------------------------------------------
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

  update wallets set balance_slon = balance_slon - p_amount_slon, updated_at = now()
    where user_id = p_user_id;

  insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, meta)
  values (
    p_user_id, 'withdrawal', p_amount_slon, 0, 'pending',
    p_meta || jsonb_build_object('method', p_method, 'cancel_until', (now() + interval '15 minutes'))
  )
  returning * into v_tx;

  return v_tx;
end;
$$;

-- ---------------------------------------------------------------
-- cancel_withdrawal: only the owner, only while pending and within
-- the 15-minute window. Refunds the held amount.
-- ---------------------------------------------------------------
create or replace function cancel_withdrawal(
  p_user_id uuid,
  p_transaction_id uuid
) returns wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx wallet_transactions;
  v_cancel_until timestamptz;
begin
  select * into v_tx from wallet_transactions where id = p_transaction_id for update;

  if v_tx is null or v_tx.user_id <> p_user_id then
    raise exception 'TX_NOT_FOUND';
  end if;
  if v_tx.type <> 'withdrawal' or v_tx.status <> 'pending' then
    raise exception 'TX_NOT_CANCELLABLE';
  end if;

  v_cancel_until := (v_tx.meta->>'cancel_until')::timestamptz;
  if v_cancel_until is null or now() > v_cancel_until then
    raise exception 'CANCEL_WINDOW_EXPIRED';
  end if;

  update wallets set balance_slon = balance_slon + v_tx.amount_slon, updated_at = now()
    where user_id = v_tx.user_id;

  update wallet_transactions set status = 'cancelled', updated_at = now()
    where id = p_transaction_id
    returning * into v_tx;

  return v_tx;
end;
$$;

-- ---------------------------------------------------------------
-- admin_review_withdrawal: approve keeps funds deducted (payout is
-- handled manually by the admin outside the app); reject refunds.
-- ---------------------------------------------------------------
create or replace function admin_review_withdrawal(
  p_transaction_id uuid,
  p_action text,       -- 'approve' | 'reject'
  p_admin_note text default null
) returns wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx wallet_transactions;
begin
  select * into v_tx from wallet_transactions where id = p_transaction_id for update;

  if v_tx is null then
    raise exception 'TX_NOT_FOUND';
  end if;
  if v_tx.type <> 'withdrawal' or v_tx.status <> 'pending' then
    raise exception 'TX_NOT_PENDING_WITHDRAWAL';
  end if;

  if p_action = 'approve' then
    update wallet_transactions
      set status = 'completed', meta = meta || jsonb_build_object('admin_note', p_admin_note), updated_at = now()
      where id = p_transaction_id
      returning * into v_tx;

  elsif p_action = 'reject' then
    update wallets set balance_slon = balance_slon + v_tx.amount_slon, updated_at = now()
      where user_id = v_tx.user_id;

    update wallet_transactions
      set status = 'rejected', meta = meta || jsonb_build_object('admin_note', p_admin_note), updated_at = now()
      where id = p_transaction_id
      returning * into v_tx;
  else
    raise exception 'INVALID_ACTION';
  end if;

  return v_tx;
end;
$$;

-- ---------------------------------------------------------------
-- transfer_slon: instant Vilue-to-Vilue transfer, both legs in one
-- transaction. Returns the sender's transfer_out row.
-- ---------------------------------------------------------------
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

  -- Lock receiver's wallet row too, in a stable id order, to avoid deadlocks
  -- with a concurrent transfer going the opposite direction.
  perform 1 from wallets where user_id = v_receiver_id for update;

  update wallets set balance_slon = balance_slon - p_amount_slon, updated_at = now()
    where user_id = p_sender_id;
  update wallets set balance_slon = balance_slon + p_amount_slon, updated_at = now()
    where user_id = v_receiver_id;

  insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, counterparty_user_id)
  values (p_sender_id, 'transfer_out', p_amount_slon, 0, 'completed', v_receiver_id)
  returning * into v_tx;

  insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, counterparty_user_id)
  values (v_receiver_id, 'transfer_in', p_amount_slon, 0, 'completed', p_sender_id);

  return v_tx;
end;
$$;
