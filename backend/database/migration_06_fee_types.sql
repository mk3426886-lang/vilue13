-- ============================================================
-- Vilue — migration 06: percent-or-fixed fee configuration
-- Run in Supabase SQL Editor (New snippet -> paste -> Run)
-- ============================================================

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

-- Carry over any values already set on the old plain-percent columns.
update platform_settings set withdrawal_fee_value = withdrawal_fee_percent where withdrawal_fee_value = 0;
update platform_settings set transfer_fee_value = transfer_fee_percent where transfer_fee_value = 0;
update platform_settings set deposit_fee_value = deposit_fee_percent where deposit_fee_value = 0;
update platform_settings set gift_commission_value = gift_commission_percent where gift_commission_value = 5;
update platform_settings set marketplace_commission_value = marketplace_commission_percent where marketplace_commission_value = 0;

-- Shared helper: interprets a fee as a % of the amount, or a flat SLON value.
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
