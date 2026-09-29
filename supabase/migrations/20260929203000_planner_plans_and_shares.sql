create table if not exists public.planner_plans (
  id text primary key,
  wallet_address text not null,
  club_id text not null,
  name text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists planner_plans_wallet_updated_idx
  on public.planner_plans (wallet_address, updated_at desc);

create table if not exists public.planner_shares (
  id text primary key,
  wallet_address text,
  club_id text not null,
  name text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists planner_shares_expires_at_idx
  on public.planner_shares (expires_at);

create index if not exists planner_shares_wallet_active_idx

alter table public.planner_plans enable row level security;
alter table public.planner_shares enable row level security;
  on public.planner_shares (wallet_address, expires_at);

revoke all on table public.planner_plans from anon, authenticated;
revoke all on table public.planner_shares from anon, authenticated;
grant select, insert, update, delete on table public.planner_plans to service_role;
grant select, insert, update, delete on table public.planner_shares to service_role;
