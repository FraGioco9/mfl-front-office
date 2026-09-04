create table if not exists public.wallet_opt_ins (
  wallet_address text primary key,
  agent_name text,
  opted_in_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.wallet_opt_ins add column if not exists agent_name text;

create table if not exists public.wallet_permissions (
  wallet_address text primary key,
  can_view_progression boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_preferences (
  wallet_address text primary key,
  watchlists jsonb not null default '[]'::jsonb,
  player_notes jsonb not null default '{}'::jsonb,
  table_state jsonb not null default '{}'::jsonb,
  evaluation_settings jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.wallet_preferences add column if not exists watchlists jsonb not null default '[]'::jsonb;
alter table public.wallet_preferences drop column if exists watchlist_player_ids;
alter table public.wallet_preferences drop column if exists current_watchlist_id;
comment on column public.wallet_preferences.watchlists is 'Opted-in user watchlists stored as an array of objects: [{"id":"7b1e706b","name":"Default","playerIds":["328858"]}]';
alter table public.wallet_preferences add column if not exists player_notes jsonb not null default '{}'::jsonb;
alter table public.wallet_preferences add column if not exists table_state jsonb not null default '{}'::jsonb;
comment on column public.wallet_preferences.table_state is 'Cloud-synced table/view state. Watchlist payloads, linked wallet identity, and legacy per-entity search arrays are intentionally excluded.';
update public.wallet_preferences
set table_state = coalesce(table_state, '{}'::jsonb)
  - 'watchlistPlayerIds'
  - 'watchlists'
  - 'currentWatchlistId'
  - 'linkedWalletAddress';
update public.wallet_preferences
set table_state = coalesce(table_state, '{}'::jsonb)
  - 'recentSearchPlayerIds'
  - 'recentSearchAgentWallets'
where jsonb_typeof(coalesce(table_state, '{}'::jsonb)->'recentSearchItems') = 'array';
alter table public.wallet_preferences add column if not exists evaluation_settings jsonb not null default '{}'::jsonb;
alter table public.wallet_preferences add column if not exists settings jsonb not null default '{}'::jsonb;

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

create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  summary text not null,
  area text not null,
  route text not null,
  reproduction text not null,
  expected_behavior text not null,
  actual_behavior text not null,
  environment text not null default '',
  evidence text not null default '',
  app_version text not null default '',
  user_agent text not null default '',
  wallet_address text,
  reporter_hash text not null,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  constraint bug_reports_summary_length_check check (char_length(summary) between 1 and 120),
  constraint bug_reports_area_check check (area in (
    'Database / MFL',
    'Club / Agent / Player pages',
    'Watchlist / My Players',
    'Evaluation',
    'Search / Filters',
    'Loading / Navigation',
    'Settings / Account',
    'Database builder / Data pipeline',
    'Other'
  )),
  constraint bug_reports_route_length_check check (char_length(route) between 1 and 300),
  constraint bug_reports_reproduction_length_check check (char_length(reproduction) between 1 and 4000),
  constraint bug_reports_expected_length_check check (char_length(expected_behavior) between 1 and 2000),
  constraint bug_reports_actual_length_check check (char_length(actual_behavior) between 1 and 2000),
  constraint bug_reports_environment_length_check check (char_length(environment) <= 300),
  constraint bug_reports_evidence_length_check check (char_length(evidence) <= 4000),
  constraint bug_reports_app_version_length_check check (char_length(app_version) <= 32),
  constraint bug_reports_user_agent_length_check check (char_length(user_agent) <= 512),
  constraint bug_reports_reporter_hash_check check (reporter_hash ~ '^[0-9a-f]{64}$'),
  constraint bug_reports_status_check check (status in ('new', 'triaged', 'planned', 'resolved', 'dismissed'))
);

create index if not exists bug_reports_reporter_created_idx on public.bug_reports (reporter_hash, created_at desc);
create index if not exists bug_reports_status_created_idx on public.bug_reports (status, created_at desc);

revoke all on table public.bug_reports from anon, authenticated;
grant select, insert, update, delete on table public.bug_reports to service_role;

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
alter table public.bug_reports enable row level security;
