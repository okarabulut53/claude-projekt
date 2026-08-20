-- Führe dieses Skript im Supabase SQL Editor deines Projekts aus
-- (Dashboard -> SQL Editor -> New query -> einfügen -> Run).

create extension if not exists pgcrypto;

create table if not exists app_users (
  id text primary key, -- Clerk user id
  email text,
  risk_profile text check (risk_profile in ('low', 'medium', 'high')),
  whatsapp_number text,
  depot_connected boolean not null default false,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists portfolio_positions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references app_users(id) on delete cascade,
  symbol text not null,
  name text not null,
  asset_class text not null check (asset_class in ('stock', 'etf', 'crypto')),
  quantity numeric not null check (quantity > 0),
  avg_price numeric not null check (avg_price >= 0),
  source text not null default 'manual' check (source in ('manual', 'depot')),
  created_at timestamptz not null default now()
);

create index if not exists portfolio_positions_user_id_idx on portfolio_positions(user_id);

create table if not exists watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references app_users(id) on delete cascade,
  symbol text not null,
  asset_class text not null check (asset_class in ('stock', 'etf', 'crypto')),
  created_at timestamptz not null default now(),
  unique (user_id, symbol)
);

create index if not exists watchlist_items_user_id_idx on watchlist_items(user_id);

create table if not exists chat_folders (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references app_users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_folders_user_id_idx on chat_folders(user_id);

create table if not exists chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references app_users(id) on delete cascade,
  folder_id uuid references chat_folders(id) on delete set null,
  title text not null default 'Neuer Chat',
  pinned boolean not null default false,
  unread boolean not null default false,
  sort_order double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_threads_user_id_idx on chat_threads(user_id);
create index if not exists chat_threads_folder_id_idx on chat_threads(folder_id);

-- Safe to re-run against a chat_threads table created before the pinned/unread/sort_order
-- columns existed (create table if not exists above is a no-op on an already-existing table).
alter table chat_threads add column if not exists pinned boolean not null default false;
alter table chat_threads add column if not exists unread boolean not null default false;
alter table chat_threads add column if not exists sort_order double precision not null default 0;

-- One-time backfill: give pre-existing rows a sort_order derived from updated_at (most recent =
-- most negative = sorts first), matching the update-at-desc ordering they had before sort_order
-- existed, instead of leaving them all at the column default of 0.
update chat_threads set sort_order = -extract(epoch from updated_at) * 1000 where sort_order = 0;

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references chat_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_thread_id_idx on chat_messages(thread_id);
