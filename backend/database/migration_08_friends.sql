-- ============================================================
-- Vilue — migration 08: friends
-- Run in Supabase SQL Editor (New snippet -> paste -> Run)
-- ============================================================

alter table users add column if not exists allow_friend_requests boolean not null default true;

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

alter table friend_requests enable row level security;
-- No public policies — backend's service_role key only.
