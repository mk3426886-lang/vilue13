-- ============================================================
-- Vilue — migration 07: single-device session enforcement
-- Run in Supabase SQL Editor (New snippet -> paste -> Run)
-- ============================================================

alter table users add column if not exists active_session_id text;
alter table users add column if not exists active_device_id text;
alter table users add column if not exists last_device_switch_at timestamptz;
