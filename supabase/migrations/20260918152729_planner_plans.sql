-- Plans use signed Dapper sessions resolved by our server, not Supabase auth.uid().
-- The API enforces owner-only writes and explicit unlisted read access.
create table if not exists public.planner_plans (
  id uuid primary key,
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-f]{16}$'),
  club_id text not null check (club_id ~ '^[1-9][0-9]{0,14}$'),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  formation_id text not null check (char_length(formation_id) between 1 and 40),
  assignments jsonb not null default '{}'::jsonb check (jsonb_typeof(assignments) = 'object' and octet_length(assignments::text) <= 4096),
  visibility text not null default 'private' check (visibility in ('private', 'unlisted')),
  revision integer not null default 1 check (revision > 0),
  schema_version integer not null default 1 check (schema_version > 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists planner_plans_wallet_updated_idx
  on public.planner_plans (wallet_address, updated_at desc, id);

alter table public.planner_plans enable row level security;
revoke all on public.planner_plans from public, anon, authenticated;
grant select, insert, update, delete on public.planner_plans to service_role;
comment on table public.planner_plans is 'Private by default. Server-authorized unlisted sharing; clients never access this table directly.';
