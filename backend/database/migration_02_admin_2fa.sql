-- ============================================================
-- Vilue — migration 02: admin + 2FA flags
-- Run this in Supabase SQL Editor (New snippet -> paste -> Run)
-- Safe to run on an existing database — uses IF NOT EXISTS.
-- ============================================================

alter table users add column if not exists is_admin boolean not null default false;
alter table users add column if not exists two_fa_enabled boolean not null default false;

-- Promote your own account to admin after registering normally through
-- the app (replace the email, then run this as its own query):
-- update users set is_admin = true where email = 'your.email@example.com';
--
-- After promoting: log OUT and back IN on that account — the admin flag
-- is embedded in the JWT at login, so an existing session won't see it
-- until a fresh token is issued.
