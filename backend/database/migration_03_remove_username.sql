-- ============================================================
-- Vilue — migration 03: remove username, 12-digit numeric ID
-- Run this in Supabase SQL Editor (New snippet -> paste -> Run)
-- ============================================================

-- Widen the public ID column (was 7 chars) to fit 12-digit IDs.
alter table users alter column display_user_id type varchar(12);

-- Username is fully retired — the 12-digit ID is now the only
-- identifier shown to other users and used for login/transfers.
alter table users drop column if exists username;
