create table if not exists public.wallet_opt_ins (
  wallet_address text primary key,
  opted_in_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.wallet_permissions (
  wallet_address text primary key,
  can_view_progression boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_preferences (
  wallet_address text primary key,
  watchlist_player_ids jsonb not null default '[]'::jsonb,
  player_notes jsonb not null default '{}'::jsonb,
  table_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.wallet_preferences add column if not exists watchlist_player_ids jsonb not null default '[]'::jsonb;
alter table public.wallet_preferences add column if not exists player_notes jsonb not null default '{}'::jsonb;
alter table public.wallet_preferences add column if not exists table_state jsonb not null default '{}'::jsonb;



create table if not exists public.evaluation_saves (
  id text primary key,
  wallet_address text not null,
  player_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.evaluation_saves alter column id type text using id::text;

create index if not exists evaluation_saves_wallet_created_idx on public.evaluation_saves (wallet_address, created_at desc);

create table if not exists public.evaluation_shares (
  id text primary key,
  wallet_address text,
  player_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.evaluation_shares alter column id type text using id::text;
alter table public.evaluation_shares add column if not exists wallet_address text;

create index if not exists evaluation_shares_expires_at_idx on public.evaluation_shares (expires_at);
create index if not exists evaluation_shares_wallet_active_idx on public.evaluation_shares (wallet_address, expires_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wallet_permissions_set_updated_at on public.wallet_permissions;
create trigger wallet_permissions_set_updated_at
before update on public.wallet_permissions
for each row
execute function public.set_updated_at();

drop trigger if exists wallet_preferences_set_updated_at on public.wallet_preferences;
create trigger wallet_preferences_set_updated_at
before update on public.wallet_preferences
for each row
execute function public.set_updated_at();

alter table public.wallet_opt_ins enable row level security;
alter table public.wallet_permissions enable row level security;
alter table public.wallet_preferences enable row level security;
alter table public.evaluation_shares enable row level security;
alter table public.evaluation_saves enable row level security;
