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
