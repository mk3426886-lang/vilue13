-- ============================================================
-- Vilue — migration 08: lower minimum task target from 1000 to 1
-- Run in Supabase SQL Editor. Safe to run even if you're not sure
-- which earlier setup script defined create_task — this just
-- redefines the same function name with the new minimum.
-- ============================================================

create or replace function create_task(
  p_creator_id uuid, p_channel_username text, p_reward_per_join bigint, p_target_joins int
) returns tasks
language plpgsql security definer set search_path = public as $$
declare v_total bigint; v_balance bigint; v_task tasks;
begin
  if p_reward_per_join < 40 then raise exception 'REWARD_TOO_LOW'; end if;
  if p_target_joins < 1 or p_target_joins > 100000 then raise exception 'INVALID_TARGET'; end if;

  v_total := p_reward_per_join * p_target_joins;

  select balance_slon into v_balance from wallets where user_id = p_creator_id for update;
  if v_balance is null then raise exception 'WALLET_NOT_FOUND'; end if;
  if v_balance < v_total then raise exception 'INSUFFICIENT_BALANCE'; end if;

  update wallets set balance_slon = balance_slon - v_total, updated_at = now() where user_id = p_creator_id;

  insert into tasks (creator_id, channel_username, reward_per_join_slon, target_joins, total_reserved_slon, status)
  values (p_creator_id, p_channel_username, p_reward_per_join, p_target_joins, v_total, 'pending_review')
  returning * into v_task;

  insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, reference_id)
  values (p_creator_id, 'task_reserve', v_total, 0, 'completed', v_task.id::text);

  return v_task;
end;
$$;
