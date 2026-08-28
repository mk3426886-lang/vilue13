-- ============================================================
-- Vilue — COMPLETE SETUP (run this whole file, any time, as many
-- times as you want — every statement is safe to repeat).
-- Paste this ENTIRE file into Supabase SQL Editor -> New snippet -> Run.
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- TABLES
-- ============================================================

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
alter table users add column if not exists is_admin boolean not null default false;
alter table users add column if not exists is_owner boolean not null default false;
alter table users add column if not exists two_fa_enabled boolean not null default false;
alter table users add column if not exists verification_badge text;
alter table users add column if not exists allow_friend_requests boolean not null default true;
alter table users add column if not exists active_session_id text;
alter table users add column if not exists active_device_id text;
alter table users add column if not exists last_device_switch_at timestamptz;
alter table users add column if not exists ban_reason text;
alter table users add column if not exists banned_until timestamptz;
alter table users add column if not exists is_deleted boolean not null default false;
alter table users add column if not exists failed_login_attempts int not null default 0;
alter table users add column if not exists locked_until timestamptz;
alter table users add column if not exists referred_by uuid references users (id);
alter table users add column if not exists avatar_url text;
alter table users add column if not exists telegram_user_id bigint unique;
alter table users add column if not exists telegram_username text;
alter table users add column if not exists telegram_link_code text;
alter table users add column if not exists telegram_link_code_expires_at timestamptz;
alter table users alter column display_user_id type varchar(12);
alter table users drop column if exists username;
create index if not exists idx_users_email on users (email);

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
    'gift_sent','gift_received','purchase','sale','marketplace_fee',
    'task_reserve','task_refund','task_reward','task_penalty'
  ));

alter table wallet_transactions drop constraint if exists wallet_transactions_status_check;
alter table wallet_transactions add constraint wallet_transactions_status_check
  check (status in ('pending','processing','approved','completed','rejected','cancelled'));

create table if not exists platform_settings (
  id boolean primary key default true check (id),
  slon_per_iqd numeric not null default 5,
  usdt_to_iqd numeric not null default 1320,
  marketplace_listing_fee_slon bigint not null default 100,
  updated_at timestamptz not null default now()
);
alter table platform_settings add column if not exists withdrawal_fee_type text not null default 'percent' check (withdrawal_fee_type in ('percent','fixed'));
alter table platform_settings add column if not exists withdrawal_fee_value numeric not null default 0;
alter table platform_settings add column if not exists transfer_fee_type text not null default 'percent' check (transfer_fee_type in ('percent','fixed'));
alter table platform_settings add column if not exists transfer_fee_value numeric not null default 0;
alter table platform_settings add column if not exists deposit_fee_type text not null default 'percent' check (deposit_fee_type in ('percent','fixed'));
alter table platform_settings add column if not exists deposit_fee_value numeric not null default 0;
alter table platform_settings add column if not exists gift_commission_type text not null default 'percent' check (gift_commission_type in ('percent','fixed'));
alter table platform_settings add column if not exists gift_commission_value numeric not null default 5;
alter table platform_settings add column if not exists marketplace_commission_type text not null default 'percent' check (marketplace_commission_type in ('percent','fixed'));
alter table platform_settings add column if not exists marketplace_commission_value numeric not null default 0;
alter table platform_settings add column if not exists news_ticker_text text not null default '';
alter table platform_settings add column if not exists promo_banner_text text not null default '';
alter table platform_settings add column if not exists promo_banner_image_url text;
insert into platform_settings (id) values (true) on conflict (id) do nothing;
alter table platform_settings add column if not exists task_commission_type text not null default 'percent' check (task_commission_type in ('percent','fixed'));
alter table platform_settings add column if not exists task_commission_value numeric not null default 0;

create table if not exists platform_wallet (
  id boolean primary key default true check (id),
  balance_slon bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into platform_wallet (id) values (true) on conflict (id) do nothing;

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
alter table marketplace_products add column if not exists is_digital boolean not null default false;
alter table marketplace_products add column if not exists delivery_content text;
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
alter table marketplace_orders add column if not exists delivery_content_snapshot text;
create index if not exists idx_orders_buyer on marketplace_orders (buyer_id);
create index if not exists idx_orders_seller on marketplace_orders (seller_id);

create table if not exists friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references users (id) on delete cascade,
  receiver_id uuid not null references users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);
create index if not exists idx_friend_requests_sender on friend_requests (sender_id, status);
create index if not exists idx_friend_requests_receiver on friend_requests (receiver_id, status);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,  -- null = broadcast to everyone
  title text not null,
  body text,
  type text not null default 'info',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on notifications (user_id, created_at desc);

create table if not exists support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  message text not null,
  status text not null default 'open' check (status in ('open','resolved')),
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_support_user on support_messages (user_id);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references users (id) on delete cascade,
  receiver_id uuid not null references users (id) on delete cascade,
  content text,
  gift_type text,
  gift_amount_slon bigint,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_pair on messages (sender_id, receiver_id, created_at);
create index if not exists idx_messages_pair2 on messages (receiver_id, sender_id, created_at);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references users (id) on delete cascade,
  type text not null default 'telegram_join' check (type in ('telegram_join')),
  channel_username text not null,
  reward_per_join_slon bigint not null check (reward_per_join_slon >= 40),
  target_joins int not null check (target_joins between 1000 and 100000),
  total_reserved_slon bigint not null,
  joins_count int not null default 0,
  status text not null default 'pending_review'
    check (status in ('pending_review','active','completed','cancelled','rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tasks_status on tasks (status);
create index if not exists idx_tasks_channel on tasks (channel_username);

create table if not exists task_participants (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  telegram_user_id bigint,
  reward_paid_slon bigint not null default 0,
  status text not null default 'joined' check (status in ('joined','left')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (task_id, user_id)
);
create index if not exists idx_task_participants_task on task_participants (task_id);
create index if not exists idx_task_participants_user on task_participants (user_id);

-- ============================================================
-- ROW LEVEL SECURITY (backend's service_role key bypasses this;
-- it just blocks the public anon key by having no policies)
-- ============================================================
alter table users enable row level security;
alter table wallets enable row level security;
alter table wallet_transactions enable row level security;
alter table platform_settings enable row level security;
alter table platform_wallet enable row level security;
alter table marketplace_products enable row level security;
alter table marketplace_orders enable row level security;
alter table friend_requests enable row level security;
alter table notifications enable row level security;
alter table support_messages enable row level security;
alter table messages enable row level security;
alter table tasks enable row level security;
alter table task_participants enable row level security;

-- ============================================================
-- FUNCTIONS
-- ============================================================

create or replace function compute_fee(p_amount bigint, p_type text, p_value numeric)
returns bigint
language sql
immutable
as $$
  select case
    when p_type = 'fixed' then greatest(round(p_value)::bigint, 0)
    else floor(p_amount * greatest(p_value, 0) / 100.0)::bigint
  end;
$$;

create or replace function request_deposit(
  p_user_id uuid, p_amount_slon bigint, p_method text, p_meta jsonb
) returns wallet_transactions
language plpgsql security definer set search_path = public as $$
declare
  v_type text; v_value numeric; v_fee bigint; v_tx wallet_transactions;
begin
  if p_amount_slon <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  select deposit_fee_type, deposit_fee_value into v_type, v_value from platform_settings where id = true;
  v_fee := compute_fee(p_amount_slon, v_type, v_value);
  insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, meta)
  values (p_user_id, 'deposit', p_amount_slon, v_fee, 'pending', p_meta || jsonb_build_object('method', p_method))
  returning * into v_tx;
  return v_tx;
end;
$$;

create or replace function admin_review_deposit(
  p_transaction_id uuid, p_action text, p_admin_note text default null
) returns wallet_transactions
language plpgsql security definer set search_path = public as $$
declare v_tx wallet_transactions; v_net bigint;
begin
  select * into v_tx from wallet_transactions where id = p_transaction_id for update;
  if v_tx is null then raise exception 'TX_NOT_FOUND'; end if;
  if v_tx.type <> 'deposit' or v_tx.status <> 'pending' then raise exception 'TX_NOT_PENDING_DEPOSIT'; end if;

  if p_action = 'approve' then
    v_net := v_tx.amount_slon - coalesce(v_tx.fee_slon, 0);
    update wallets set balance_slon = balance_slon + v_net, updated_at = now() where user_id = v_tx.user_id;
    if coalesce(v_tx.fee_slon, 0) > 0 then
      update platform_wallet set balance_slon = balance_slon + v_tx.fee_slon, updated_at = now() where id = true;
    end if;
    update wallet_transactions set status = 'completed', meta = meta || jsonb_build_object('admin_note', p_admin_note), updated_at = now()
      where id = p_transaction_id returning * into v_tx;
    insert into notifications (user_id, title, body, type)
    values (v_tx.user_id, 'تم قبول الإيداع ✅', concat('تمت إضافة ', v_net, ' سلون لرصيدك'), 'deposit');
  elsif p_action = 'reject' then
    update wallet_transactions set status = 'rejected', meta = meta || jsonb_build_object('admin_note', p_admin_note), updated_at = now()
      where id = p_transaction_id returning * into v_tx;
    insert into notifications (user_id, title, body, type)
    values (v_tx.user_id, 'تم رفض طلب الإيداع ❌', p_admin_note, 'deposit');
  else raise exception 'INVALID_ACTION'; end if;
  return v_tx;
end;
$$;

create or replace function request_withdrawal(
  p_user_id uuid, p_amount_slon bigint, p_method text, p_meta jsonb
) returns wallet_transactions
language plpgsql security definer set search_path = public as $$
declare v_balance bigint; v_type text; v_value numeric; v_fee bigint; v_tx wallet_transactions;
begin
  if p_amount_slon <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  select balance_slon into v_balance from wallets where user_id = p_user_id for update;
  if v_balance is null then raise exception 'WALLET_NOT_FOUND'; end if;
  if v_balance < p_amount_slon then raise exception 'INSUFFICIENT_BALANCE'; end if;

  select withdrawal_fee_type, withdrawal_fee_value into v_type, v_value from platform_settings where id = true;
  v_fee := compute_fee(p_amount_slon, v_type, v_value);

  update wallets set balance_slon = balance_slon - p_amount_slon, updated_at = now() where user_id = p_user_id;
  insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, meta)
  values (p_user_id, 'withdrawal', p_amount_slon, v_fee, 'pending',
    p_meta || jsonb_build_object('method', p_method, 'cancel_until', (now() + interval '15 minutes')))
  returning * into v_tx;
  return v_tx;
end;
$$;

create or replace function admin_review_withdrawal(
  p_transaction_id uuid, p_action text, p_admin_note text default null
) returns wallet_transactions
language plpgsql security definer set search_path = public as $$
declare v_tx wallet_transactions;
begin
  select * into v_tx from wallet_transactions where id = p_transaction_id for update;
  if v_tx is null then raise exception 'TX_NOT_FOUND'; end if;
  if v_tx.type <> 'withdrawal' or v_tx.status <> 'pending' then raise exception 'TX_NOT_PENDING_WITHDRAWAL'; end if;

  if p_action = 'approve' then
    if coalesce(v_tx.fee_slon, 0) > 0 then
      update platform_wallet set balance_slon = balance_slon + v_tx.fee_slon, updated_at = now() where id = true;
    end if;
    update wallet_transactions set status = 'completed', meta = meta || jsonb_build_object('admin_note', p_admin_note), updated_at = now()
      where id = p_transaction_id returning * into v_tx;
    insert into notifications (user_id, title, body, type)
    values (v_tx.user_id, 'تمت الموافقة على السحب ✅', 'جاري تحويل مبلغك بالطريقة المختارة', 'withdrawal');
  elsif p_action = 'reject' then
    update wallets set balance_slon = balance_slon + v_tx.amount_slon, updated_at = now() where user_id = v_tx.user_id;
    update wallet_transactions set status = 'rejected', meta = meta || jsonb_build_object('admin_note', p_admin_note), updated_at = now()
      where id = p_transaction_id returning * into v_tx;
    insert into notifications (user_id, title, body, type)
    values (v_tx.user_id, 'تم رفض طلب السحب ❌', p_admin_note, 'withdrawal');
  else raise exception 'INVALID_ACTION'; end if;
  return v_tx;
end;
$$;

create or replace function cancel_withdrawal(
  p_user_id uuid, p_transaction_id uuid
) returns wallet_transactions
language plpgsql security definer set search_path = public as $$
declare v_tx wallet_transactions; v_cancel_until timestamptz;
begin
  select * into v_tx from wallet_transactions where id = p_transaction_id for update;
  if v_tx is null or v_tx.user_id <> p_user_id then raise exception 'TX_NOT_FOUND'; end if;
  if v_tx.type <> 'withdrawal' or v_tx.status <> 'pending' then raise exception 'TX_NOT_CANCELLABLE'; end if;

  v_cancel_until := (v_tx.meta->>'cancel_until')::timestamptz;
  if v_cancel_until is null or now() > v_cancel_until then raise exception 'CANCEL_WINDOW_EXPIRED'; end if;

  update wallets set balance_slon = balance_slon + v_tx.amount_slon, updated_at = now() where user_id = v_tx.user_id;
  update wallet_transactions set status = 'cancelled', updated_at = now() where id = p_transaction_id returning * into v_tx;
  return v_tx;
end;
$$;

create or replace function transfer_slon(
  p_sender_id uuid, p_receiver_display_id text, p_amount_slon bigint
) returns wallet_transactions
language plpgsql security definer set search_path = public as $$
declare
  v_sender_balance bigint; v_receiver_id uuid; v_type text; v_value numeric;
  v_fee bigint; v_net bigint; v_tx wallet_transactions;
begin
  if p_amount_slon <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  select id into v_receiver_id from users where display_user_id = p_receiver_display_id;
  if v_receiver_id is null then raise exception 'RECEIVER_NOT_FOUND'; end if;
  if v_receiver_id = p_sender_id then raise exception 'CANNOT_TRANSFER_TO_SELF'; end if;

  select balance_slon into v_sender_balance from wallets where user_id = p_sender_id for update;
  if v_sender_balance is null then raise exception 'WALLET_NOT_FOUND'; end if;
  if v_sender_balance < p_amount_slon then raise exception 'INSUFFICIENT_BALANCE'; end if;

  perform 1 from wallets where user_id = v_receiver_id for update;

  select transfer_fee_type, transfer_fee_value into v_type, v_value from platform_settings where id = true;
  v_fee := compute_fee(p_amount_slon, v_type, v_value);
  v_net := p_amount_slon - v_fee;

  update wallets set balance_slon = balance_slon - p_amount_slon, updated_at = now() where user_id = p_sender_id;
  update wallets set balance_slon = balance_slon + v_net, updated_at = now() where user_id = v_receiver_id;
  if v_fee > 0 then
    update platform_wallet set balance_slon = balance_slon + v_fee, updated_at = now() where id = true;
  end if;

  insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, counterparty_user_id)
  values (p_sender_id, 'transfer_out', p_amount_slon, v_fee, 'completed', v_receiver_id)
  returning * into v_tx;
  insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, counterparty_user_id)
  values (v_receiver_id, 'transfer_in', v_net, 0, 'completed', p_sender_id);

  insert into notifications (user_id, title, body, type)
  values (v_receiver_id, 'استلمت تحويل 💸', concat('استلمت ', v_net, ' سلون'), 'transfer');

  return v_tx;
end;
$$;

create or replace function create_listing(
  p_seller_id uuid, p_title text, p_description text, p_price_slon bigint,
  p_image_url text, p_category text, p_is_admin_listing boolean default false,
  p_is_digital boolean default false, p_delivery_content text default null
) returns marketplace_products
language plpgsql security definer set search_path = public as $$
declare v_fee bigint := 0; v_balance bigint; v_product marketplace_products;
begin
  if p_price_slon <= 0 then raise exception 'INVALID_PRICE'; end if;

  if not p_is_admin_listing then
    select marketplace_listing_fee_slon into v_fee from platform_settings where id = true;
    v_fee := coalesce(v_fee, 0);
    if v_fee > 0 then
      select balance_slon into v_balance from wallets where user_id = p_seller_id for update;
      if v_balance is null then raise exception 'WALLET_NOT_FOUND'; end if;
      if v_balance < v_fee then raise exception 'INSUFFICIENT_BALANCE'; end if;
      update wallets set balance_slon = balance_slon - v_fee, updated_at = now() where user_id = p_seller_id;
      update platform_wallet set balance_slon = balance_slon + v_fee, updated_at = now() where id = true;
      insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, meta)
      values (p_seller_id, 'marketplace_fee', v_fee, 0, 'completed', jsonb_build_object('reason', 'listing_fee'));
    end if;
  end if;

  insert into marketplace_products (
    seller_id, created_by_admin, title, description, price_slon, image_url, category,
    listing_fee_slon, status, is_digital, delivery_content
  ) values (
    case when p_is_admin_listing then null else p_seller_id end,
    p_is_admin_listing, p_title, p_description, p_price_slon, p_image_url, p_category,
    v_fee, case when p_is_admin_listing then 'approved' else 'pending_review' end,
    p_is_digital, p_delivery_content
  ) returning * into v_product;
  return v_product;
end;
$$;

create or replace function admin_review_listing(
  p_product_id uuid, p_action text, p_admin_note text default null
) returns marketplace_products
language plpgsql security definer set search_path = public as $$
declare v_product marketplace_products;
begin
  select * into v_product from marketplace_products where id = p_product_id for update;
  if v_product is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if v_product.status <> 'pending_review' then raise exception 'PRODUCT_NOT_PENDING'; end if;

  if p_action = 'approve' then
    update marketplace_products set status = 'approved', admin_note = p_admin_note, updated_at = now()
      where id = p_product_id returning * into v_product;
  elsif p_action = 'reject' then
    if v_product.listing_fee_slon > 0 and v_product.seller_id is not null then
      update wallets set balance_slon = balance_slon + v_product.listing_fee_slon, updated_at = now() where user_id = v_product.seller_id;
      update platform_wallet set balance_slon = balance_slon - v_product.listing_fee_slon, updated_at = now() where id = true;
      insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, meta)
      values (v_product.seller_id, 'marketplace_fee', v_product.listing_fee_slon, 0, 'cancelled', jsonb_build_object('reason', 'listing_fee_refund'));
    end if;
    update marketplace_products set status = 'rejected', admin_note = p_admin_note, updated_at = now()
      where id = p_product_id returning * into v_product;
  else raise exception 'INVALID_ACTION'; end if;
  return v_product;
end;
$$;

create or replace function purchase_product(
  p_buyer_id uuid, p_product_id uuid
) returns marketplace_orders
language plpgsql security definer set search_path = public as $$
declare
  v_product marketplace_products; v_buyer_balance bigint; v_type text; v_value numeric;
  v_commission bigint; v_seller_net bigint; v_order marketplace_orders;
begin
  select * into v_product from marketplace_products where id = p_product_id for update;
  if v_product is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if v_product.status <> 'approved' then raise exception 'PRODUCT_NOT_AVAILABLE'; end if;
  if v_product.seller_id = p_buyer_id then raise exception 'CANNOT_BUY_OWN_LISTING'; end if;

  select balance_slon into v_buyer_balance from wallets where user_id = p_buyer_id for update;
  if v_buyer_balance is null then raise exception 'WALLET_NOT_FOUND'; end if;
  if v_buyer_balance < v_product.price_slon then raise exception 'INSUFFICIENT_BALANCE'; end if;

  select marketplace_commission_type, marketplace_commission_value into v_type, v_value from platform_settings where id = true;
  v_commission := compute_fee(v_product.price_slon, v_type, v_value);
  if v_commission > v_product.price_slon then v_commission := v_product.price_slon; end if;
  v_seller_net := v_product.price_slon - v_commission;

  update wallets set balance_slon = balance_slon - v_product.price_slon, updated_at = now() where user_id = p_buyer_id;

  if v_product.seller_id is not null then
    perform 1 from wallets where user_id = v_product.seller_id for update;
    update wallets set balance_slon = balance_slon + v_seller_net, updated_at = now() where user_id = v_product.seller_id;
    update platform_wallet set balance_slon = balance_slon + v_commission, updated_at = now() where id = true;
  else
    update platform_wallet set balance_slon = balance_slon + v_product.price_slon, updated_at = now() where id = true;
  end if;

  update marketplace_products set status = 'sold', updated_at = now() where id = p_product_id;
  insert into marketplace_orders (product_id, buyer_id, seller_id, price_slon, commission_slon, delivery_content_snapshot)
  values (p_product_id, p_buyer_id, v_product.seller_id, v_product.price_slon, v_commission, v_product.delivery_content)
  returning * into v_order;

  insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, counterparty_user_id, reference_id)
  values (p_buyer_id, 'purchase', v_product.price_slon, 0, 'completed', v_product.seller_id, v_product.id::text);
  if v_product.seller_id is not null then
    insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, counterparty_user_id, reference_id)
    values (v_product.seller_id, 'sale', v_seller_net, v_commission, 'completed', p_buyer_id, v_product.id::text);
    insert into notifications (user_id, title, body, type)
    values (v_product.seller_id, 'تم بيع منتجك 🛍️', concat('بيع "', v_product.title, '" مقابل ', v_seller_net, ' سلون'), 'sale');
  end if;
  return v_order;
end;
$$;

create or replace function send_gift(
  p_sender_id uuid, p_receiver_id uuid, p_gift_type text, p_gift_value_slon bigint
) returns messages
language plpgsql security definer set search_path = public as $$
declare
  v_sender_balance bigint; v_type text; v_value numeric; v_commission bigint; v_net bigint; v_msg messages;
begin
  if p_gift_value_slon <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_sender_id = p_receiver_id then raise exception 'CANNOT_GIFT_SELF'; end if;

  select balance_slon into v_sender_balance from wallets where user_id = p_sender_id for update;
  if v_sender_balance is null then raise exception 'WALLET_NOT_FOUND'; end if;
  if v_sender_balance < p_gift_value_slon then raise exception 'INSUFFICIENT_BALANCE'; end if;

  perform 1 from wallets where user_id = p_receiver_id for update;

  select gift_commission_type, gift_commission_value into v_type, v_value from platform_settings where id = true;
  v_commission := compute_fee(p_gift_value_slon, v_type, v_value);
  v_net := p_gift_value_slon - v_commission;

  update wallets set balance_slon = balance_slon - p_gift_value_slon, updated_at = now() where user_id = p_sender_id;
  update wallets set balance_slon = balance_slon + v_net, updated_at = now() where user_id = p_receiver_id;
  if v_commission > 0 then
    update platform_wallet set balance_slon = balance_slon + v_commission, updated_at = now() where id = true;
  end if;

  insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, counterparty_user_id)
  values (p_sender_id, 'gift_sent', p_gift_value_slon, v_commission, 'completed', p_receiver_id);
  insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, counterparty_user_id)
  values (p_receiver_id, 'gift_received', v_net, 0, 'completed', p_sender_id);

  insert into messages (sender_id, receiver_id, gift_type, gift_amount_slon)
  values (p_sender_id, p_receiver_id, p_gift_type, p_gift_value_slon)
  returning * into v_msg;

  insert into notifications (user_id, title, body, type)
  values (p_receiver_id, 'وصلتك هدية 🎁', 'استلمت هدية جديدة', 'gift');

  return v_msg;
end;
$$;

create or replace function create_task(
  p_creator_id uuid, p_channel_username text, p_reward_per_join bigint, p_target_joins int
) returns tasks
language plpgsql security definer set search_path = public as $$
declare v_total bigint; v_balance bigint; v_task tasks;
begin
  if p_reward_per_join < 40 then raise exception 'REWARD_TOO_LOW'; end if;
  if p_target_joins < 1000 or p_target_joins > 100000 then raise exception 'INVALID_TARGET'; end if;

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

create or replace function admin_review_task(
  p_task_id uuid, p_action text, p_admin_note text default null
) returns tasks
language plpgsql security definer set search_path = public as $$
declare v_task tasks;
begin
  select * into v_task from tasks where id = p_task_id for update;
  if v_task is null then raise exception 'TASK_NOT_FOUND'; end if;
  if v_task.status <> 'pending_review' then raise exception 'TASK_NOT_PENDING'; end if;

  if p_action = 'approve' then
    update tasks set status = 'active', admin_note = p_admin_note, updated_at = now()
      where id = p_task_id returning * into v_task;
  elsif p_action = 'reject' then
    update wallets set balance_slon = balance_slon + v_task.total_reserved_slon, updated_at = now()
      where user_id = v_task.creator_id;
    insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, reference_id)
    values (v_task.creator_id, 'task_refund', v_task.total_reserved_slon, 0, 'completed', v_task.id::text);
    update tasks set status = 'rejected', admin_note = p_admin_note, updated_at = now()
      where id = p_task_id returning * into v_task;
  else raise exception 'INVALID_ACTION'; end if;

  return v_task;
end;
$$;

create or replace function cancel_task(
  p_user_id uuid, p_task_id uuid
) returns tasks
language plpgsql security definer set search_path = public as $$
declare v_task tasks; v_refund bigint;
begin
  select * into v_task from tasks where id = p_task_id for update;
  if v_task is null or v_task.creator_id <> p_user_id then raise exception 'TASK_NOT_FOUND'; end if;
  if v_task.status not in ('pending_review','active') then raise exception 'TASK_NOT_CANCELLABLE'; end if;

  v_refund := v_task.total_reserved_slon - (v_task.joins_count * v_task.reward_per_join_slon);
  if v_refund > 0 then
    update wallets set balance_slon = balance_slon + v_refund, updated_at = now() where user_id = p_user_id;
    insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, reference_id)
    values (p_user_id, 'task_refund', v_refund, 0, 'completed', v_task.id::text);
  end if;

  update tasks set status = 'cancelled', updated_at = now() where id = p_task_id returning * into v_task;
  return v_task;
end;
$$;

-- Called by the Telegram webhook handler when a linked user joins the channel.
create or replace function process_task_join(
  p_task_id uuid, p_user_id uuid, p_telegram_user_id bigint
) returns task_participants
language plpgsql security definer set search_path = public as $$
declare
  v_task tasks; v_type text; v_value numeric; v_commission bigint; v_net bigint; v_participant task_participants;
begin
  select * into v_task from tasks where id = p_task_id for update;
  if v_task is null or v_task.status <> 'active' then raise exception 'TASK_NOT_ACTIVE'; end if;
  if v_task.joins_count >= v_task.target_joins then raise exception 'TASK_FULL'; end if;
  if v_task.creator_id = p_user_id then raise exception 'CANNOT_JOIN_OWN_TASK'; end if;

  -- Already rewarded for this task — ignore duplicate join events (e.g. leave+rejoin).
  select * into v_participant from task_participants where task_id = p_task_id and user_id = p_user_id;
  if v_participant is not null then raise exception 'ALREADY_PARTICIPATED'; end if;

  select task_commission_type, task_commission_value into v_type, v_value from platform_settings where id = true;
  v_commission := compute_fee(v_task.reward_per_join_slon, v_type, v_value);
  v_net := v_task.reward_per_join_slon - v_commission;

  update wallets set balance_slon = balance_slon + v_net, updated_at = now() where user_id = p_user_id;
  if v_commission > 0 then
    update platform_wallet set balance_slon = balance_slon + v_commission, updated_at = now() where id = true;
  end if;

  update tasks set joins_count = joins_count + 1,
    status = case when joins_count + 1 >= target_joins then 'completed' else status end,
    updated_at = now()
    where id = p_task_id;

  insert into task_participants (task_id, user_id, telegram_user_id, reward_paid_slon, status)
  values (p_task_id, p_user_id, p_telegram_user_id, v_net, 'joined')
  returning * into v_participant;

  insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, reference_id)
  values (p_user_id, 'task_reward', v_net, v_commission, 'completed', p_task_id::text);

  insert into notifications (user_id, title, body, type)
  values (p_user_id, 'حصلت على مكافأة انضمام 🎯', concat('استلمت ', v_net, ' سلون لانضمامك للقناة'), 'task');

  return v_participant;
end;
$$;

-- Called by the Telegram webhook handler when a rewarded user leaves the channel.
create or replace function process_task_leave(
  p_task_id uuid, p_user_id uuid
) returns task_participants
language plpgsql security definer set search_path = public as $$
declare v_task tasks; v_participant task_participants; v_penalty bigint; v_balance bigint;
begin
  select * into v_task from tasks where id = p_task_id for update;
  if v_task is null then raise exception 'TASK_NOT_FOUND'; end if;

  select * into v_participant from task_participants where task_id = p_task_id and user_id = p_user_id for update;
  if v_participant is null or v_participant.status <> 'joined' then raise exception 'NOT_AN_ACTIVE_PARTICIPANT'; end if;

  select balance_slon into v_balance from wallets where user_id = p_user_id for update;
  v_penalty := least(coalesce(v_balance, 0), v_task.reward_per_join_slon);

  if v_penalty > 0 then
    update wallets set balance_slon = balance_slon - v_penalty, updated_at = now() where user_id = p_user_id;
    update platform_wallet set balance_slon = balance_slon + v_penalty, updated_at = now() where id = true;
  end if;

  update task_participants set status = 'left', left_at = now() where id = v_participant.id
    returning * into v_participant;

  insert into wallet_transactions (user_id, type, amount_slon, fee_slon, status, reference_id)
  values (p_user_id, 'task_penalty', greatest(v_penalty, 1), 0, 'completed', p_task_id::text);

  insert into notifications (user_id, title, body, type)
  values (p_user_id, 'تم خصم رصيد ⚠️', 'غادرت قناة كنت قد انضممت لها مقابل مكافأة، تم خصم المكافأة', 'task');

  return v_participant;
end;
$$;

-- ============================================================
-- Make your account the owner — EDIT THE EMAIL if it's not yours,
-- then this whole file (including this line) is safe to re-run.
-- ============================================================
update users set is_admin = true, is_owner = true, verification_badge = 'owner'
  where email = 'mk3428668@gmail.com';

select id, display_user_id, email, is_admin, is_owner, verification_badge
from users where email = 'mk3428668@gmail.com';
