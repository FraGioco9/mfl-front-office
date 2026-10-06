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

create table if not exists public.planner_plans (
  id text primary key,
  wallet_address text not null,
  club_id text not null,
  name text not null,
  payload jsonb not null default '{}'::jsonb,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.planner_plans add column if not exists revision integer not null default 1;

create index if not exists planner_plans_wallet_updated_idx
  on public.planner_plans (wallet_address, updated_at desc);

create table if not exists public.planner_shares (
  id text primary key,
  wallet_address text,
  source_plan_id text references public.planner_plans(id) on delete cascade,
  club_id text not null,
  name text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists planner_shares_expires_at_idx on public.planner_shares (expires_at);
alter table public.planner_shares add column if not exists source_plan_id text;
create index if not exists planner_shares_wallet_active_idx on public.planner_shares (wallet_address, expires_at);
create unique index if not exists planner_shares_wallet_source_idx on public.planner_shares (wallet_address, source_plan_id);
create index if not exists planner_shares_source_plan_idx on public.planner_shares (source_plan_id);

alter table public.planner_plans enable row level security;
alter table public.planner_shares enable row level security;

revoke all on table public.planner_plans from anon, authenticated;
revoke all on table public.planner_shares from anon, authenticated;
grant select, insert, update, delete on table public.planner_plans to service_role;
grant select, insert, update, delete on table public.planner_shares to service_role;

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
set search_path = ''
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

create or replace function public.patch_wallet_preferences_atomic(
  p_wallet_address text,
  p_patch jsonb
)
returns setof public.wallet_preferences
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_patch jsonb := coalesce(p_patch, '{}'::jsonb);
  v_row public.wallet_preferences%rowtype;
  v_incoming_table_state jsonb;
  v_table_state jsonb;
  v_recent_search_items jsonb;
  v_recent_evaluation_ids jsonb;
begin
  if nullif(btrim(p_wallet_address), '') is null then
    raise exception 'wallet address is required';
  end if;

  insert into public.wallet_preferences (wallet_address)
  values (p_wallet_address)
  on conflict (wallet_address) do nothing;

  select *
  into v_row
  from public.wallet_preferences
  where wallet_address = p_wallet_address
  for update;

  v_table_state := coalesce(v_row.table_state, '{}'::jsonb);

  if v_patch ? 'table_state' then
    v_incoming_table_state := case
      when jsonb_typeof(v_patch->'table_state') = 'object' then v_patch->'table_state'
      else '{}'::jsonb
    end;

    v_table_state := v_table_state || (v_incoming_table_state - 'recentSearchItems' - 'recentEvaluationPlayerIds');

    if v_incoming_table_state ? 'recentSearchItems' then
      select coalesce(jsonb_agg(ranked.value order by ranked.first_ord), '[]'::jsonb)
      into v_recent_search_items
      from (
        select candidates.value, min(candidates.ord) as first_ord
        from (
          select value, ordinality::bigint as ord
          from jsonb_array_elements_text(
            case
              when jsonb_typeof(v_incoming_table_state->'recentSearchItems') = 'array'
                then v_incoming_table_state->'recentSearchItems'
              else '[]'::jsonb
            end
          ) with ordinality
          union all
          select value, 1000000 + ordinality::bigint as ord
          from jsonb_array_elements_text(
            case
              when jsonb_typeof(v_table_state->'recentSearchItems') = 'array'
                then v_table_state->'recentSearchItems'
              else '[]'::jsonb
            end
          ) with ordinality
        ) candidates
        where btrim(candidates.value) <> ''
        group by candidates.value
        order by min(candidates.ord)
        limit 5
      ) ranked;
      v_table_state := jsonb_set(v_table_state, '{recentSearchItems}', v_recent_search_items, true);
    end if;

    if v_incoming_table_state ? 'recentEvaluationPlayerIds' then
      select coalesce(jsonb_agg(ranked.value order by ranked.first_ord), '[]'::jsonb)
      into v_recent_evaluation_ids
      from (
        select candidates.value, min(candidates.ord) as first_ord
        from (
          select value, ordinality::bigint as ord
          from jsonb_array_elements_text(
            case
              when jsonb_typeof(v_incoming_table_state->'recentEvaluationPlayerIds') = 'array'
                then v_incoming_table_state->'recentEvaluationPlayerIds'
              else '[]'::jsonb
            end
          ) with ordinality
          union all
          select value, 1000000 + ordinality::bigint as ord
          from jsonb_array_elements_text(
            case
              when jsonb_typeof(v_table_state->'recentEvaluationPlayerIds') = 'array'
                then v_table_state->'recentEvaluationPlayerIds'
              else '[]'::jsonb
            end
          ) with ordinality
        ) candidates
        where btrim(candidates.value) <> ''
        group by candidates.value
        order by min(candidates.ord)
        limit 5
      ) ranked;
      v_table_state := jsonb_set(v_table_state, '{recentEvaluationPlayerIds}', v_recent_evaluation_ids, true);
    end if;
  end if;

  update public.wallet_preferences
  set
    watchlists = case
      when v_patch ? 'watchlists' and jsonb_typeof(v_patch->'watchlists') = 'array' then v_patch->'watchlists'
      else watchlists
    end,
    player_notes = case
      when v_patch ? 'player_notes' and jsonb_typeof(v_patch->'player_notes') = 'object' then v_patch->'player_notes'
      else player_notes
    end,
    table_state = v_table_state,
    evaluation_settings = case
      when v_patch ? 'evaluation_settings' and jsonb_typeof(v_patch->'evaluation_settings') = 'object' then v_patch->'evaluation_settings'
      else evaluation_settings
    end,
    settings = case
      when v_patch ? 'settings' and jsonb_typeof(v_patch->'settings') = 'object' then v_patch->'settings'
      else settings
    end
  where wallet_address = p_wallet_address
  returning * into v_row;

  return next v_row;
  return;
end;
$$;

revoke all on function public.patch_wallet_preferences_atomic(text, jsonb) from public, anon, authenticated;
grant execute on function public.patch_wallet_preferences_atomic(text, jsonb) to service_role;

alter table public.wallet_opt_ins enable row level security;
alter table public.wallet_permissions enable row level security;
alter table public.wallet_preferences enable row level security;
alter table public.evaluation_shares enable row level security;
alter table public.evaluation_saves enable row level security;
alter table public.bug_reports enable row level security;

create table if not exists public.wallet_auth_consumed_challenges (
  nonce text primary key,
  wallet_address text not null,
  challenge_expires_at timestamptz not null,
  consumed_at timestamptz not null default now(),
  constraint wallet_auth_consumed_challenges_nonce_check
    check (nonce ~ '^[0-9a-f]{64}$'),
  constraint wallet_auth_consumed_challenges_wallet_check
    check (wallet_address ~ '^0x[0-9a-f]{16}$')
);

create index if not exists wallet_auth_consumed_challenges_expiry_idx
  on public.wallet_auth_consumed_challenges (challenge_expires_at);

create table if not exists public.wallet_auth_sessions (
  session_hash text primary key,
  wallet_address text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint wallet_auth_sessions_hash_check
    check (session_hash ~ '^[0-9a-f]{64}$'),
  constraint wallet_auth_sessions_wallet_check
    check (wallet_address ~ '^0x[0-9a-f]{16}$'),
  constraint wallet_auth_sessions_expiry_check
    check (expires_at > created_at)
);

create index if not exists wallet_auth_sessions_wallet_expiry_idx
  on public.wallet_auth_sessions (wallet_address, expires_at desc);

create index if not exists wallet_auth_sessions_active_expiry_idx
  on public.wallet_auth_sessions (expires_at)
  where revoked_at is null;

alter table public.wallet_auth_consumed_challenges enable row level security;
alter table public.wallet_auth_sessions enable row level security;

revoke all on table public.wallet_auth_consumed_challenges from public, anon, authenticated;
revoke all on table public.wallet_auth_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.wallet_auth_consumed_challenges to service_role;
grant select, insert, update, delete on table public.wallet_auth_sessions to service_role;

create or replace function public.consume_wallet_challenge_and_create_session(
  p_nonce text,
  p_wallet_address text,
  p_challenge_expires_at timestamptz,
  p_session_hash text,
  p_session_expires_at timestamptz
)
returns table (
  wallet_address text,
  expires_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_inserted integer := 0;
begin
  if p_nonce is null or p_nonce !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid wallet challenge nonce';
  end if;
  if p_wallet_address is null or p_wallet_address !~ '^0x[0-9a-f]{16}$' then
    raise exception 'invalid wallet address';
  end if;
  if p_session_hash is null or p_session_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid wallet session hash';
  end if;
  if p_challenge_expires_at is null or p_challenge_expires_at <= v_now then
    return;
  end if;
  if p_session_expires_at is null
      or p_session_expires_at <= v_now
      or p_session_expires_at > v_now + interval '8 days' then
    raise exception 'invalid wallet session expiry';
  end if;

  delete from public.wallet_auth_consumed_challenges
  where challenge_expires_at <= v_now;

  delete from public.wallet_auth_sessions
  where expires_at <= v_now
     or (revoked_at is not null and revoked_at <= v_now - interval '1 day');

  insert into public.wallet_auth_consumed_challenges (
    nonce,
    wallet_address,
    challenge_expires_at
  )
  values (
    p_nonce,
    p_wallet_address,
    p_challenge_expires_at
  )
  on conflict (nonce) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted <> 1 then
    return;
  end if;

  insert into public.wallet_auth_sessions (
    session_hash,
    wallet_address,
    expires_at
  )
  values (
    p_session_hash,
    p_wallet_address,
    p_session_expires_at
  );

  return query
  select p_wallet_address, p_session_expires_at;
end;
$$;

create or replace function public.resolve_wallet_session(
  p_session_hash text
)
returns table (
  wallet_address text,
  expires_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select sessions.wallet_address, sessions.expires_at
  from public.wallet_auth_sessions as sessions
  where sessions.session_hash = p_session_hash
    and sessions.revoked_at is null
    and sessions.expires_at > statement_timestamp()
  limit 1;
$$;

create or replace function public.revoke_wallet_session(
  p_session_hash text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated integer := 0;
begin
  update public.wallet_auth_sessions
  set revoked_at = clock_timestamp()
  where session_hash = p_session_hash
    and revoked_at is null
    and expires_at > clock_timestamp();

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.consume_wallet_challenge_and_create_session(text, text, timestamptz, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.resolve_wallet_session(text)
  from public, anon, authenticated;
revoke all on function public.revoke_wallet_session(text)
  from public, anon, authenticated;

grant execute on function public.consume_wallet_challenge_and_create_session(text, text, timestamptz, text, timestamptz)
  to service_role;
grant execute on function public.resolve_wallet_session(text)
  to service_role;
grant execute on function public.revoke_wallet_session(text)
  to service_role;

-- SEC-03 (#1034): shared, atomic wallet authentication throttling.
-- Store only HMAC-SHA256 keys (derived from trusted client IP, operation and service secret).
create table if not exists public.wallet_auth_rate_limits (
  bucket_key text primary key,
  hits integer not null,
  window_ends_at timestamptz not null,
  constraint wallet_auth_rate_limits_key_check check (bucket_key ~ '^[0-9a-f]{64}$'),
  constraint wallet_auth_rate_limits_hits_check check (hits > 0)
);

create index if not exists wallet_auth_rate_limits_expiry_idx
  on public.wallet_auth_rate_limits (window_ends_at);

alter table public.wallet_auth_rate_limits enable row level security;
revoke all on table public.wallet_auth_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.wallet_auth_rate_limits to service_role;

create or replace function public.consume_wallet_auth_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_ends_at timestamptz;
begin
  if p_bucket_key is null or p_bucket_key !~ '^[0-9a-f]{64}$'
      or p_limit is null or p_limit < 1 or p_limit > 100
      or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 3600 then
    raise exception 'invalid wallet authentication rate-limit arguments';
  end if;

  -- Opportunistically remove old buckets; bounded indexed pruning avoids a separate cron dependency.
  if random() < 0.01 then
    delete from public.wallet_auth_rate_limits
    where window_ends_at < v_now - interval '1 hour';
  end if;

  insert into public.wallet_auth_rate_limits as buckets (bucket_key, hits, window_ends_at)
  values (p_bucket_key, 1, v_now + make_interval(secs => p_window_seconds))
  on conflict (bucket_key) do update
    set hits = case when buckets.window_ends_at <= v_now then 1 else buckets.hits + 1 end,
        window_ends_at = case
          when buckets.window_ends_at <= v_now then v_now + make_interval(secs => p_window_seconds)
          else buckets.window_ends_at
        end
    where buckets.window_ends_at <= v_now or buckets.hits < p_limit
  returning buckets.window_ends_at into v_ends_at;

  if found then
    return query select true, 0;
    return;
  end if;

  select buckets.window_ends_at into v_ends_at
  from public.wallet_auth_rate_limits as buckets
  where buckets.bucket_key = p_bucket_key;

  return query select false,
    greatest(1, least(p_window_seconds, ceil(extract(epoch from (v_ends_at - clock_timestamp())))::integer));
end;
$$;

revoke all on function public.consume_wallet_auth_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_wallet_auth_rate_limit(text, integer, integer)
  to service_role;

-- SEC-05 (#1034): preserve service-role-only access for all application data.
-- Audited on 2026-10-01 against the live public schema (12 RLS-enabled tables,
-- no client-facing RLS policies). Do not add anon/authenticated policies.
-- This migration is STAGED ONLY until the user's final issue-wide release gate.
--
-- Legacy Supabase defaults granted broad DML (including TRUNCATE) to anon and
-- authenticated on six tables. RLS currently denies row access, but explicit
-- revocation closes the extra privileges and avoids future policy exposure.
--
-- Include all 12 known tables so the intended deny-by-default boundary is
-- consistent regardless of the earlier migration that created each table.
revoke all privileges on table
  public.bug_reports,
  public.evaluation_saves,
  public.evaluation_shares,
  public.mfl_season_ratios,
  public.planner_plans,
  public.planner_shares,
  public.wallet_auth_consumed_challenges,
  public.wallet_auth_rate_limits,
  public.wallet_auth_sessions,
  public.wallet_opt_ins,
  public.wallet_permissions,
  public.wallet_preferences
from public, anon, authenticated;

-- Only server-side REST/RPC callers use these tables. Reassert required
-- service-role DML explicitly; do not remove existing service-role privileges.
grant select, insert, update, delete on table
  public.bug_reports,
  public.evaluation_saves,
  public.evaluation_shares,
  public.mfl_season_ratios,
  public.planner_plans,
  public.planner_shares,
  public.wallet_auth_consumed_challenges,
  public.wallet_auth_rate_limits,
  public.wallet_auth_sessions,
  public.wallet_opt_ins,
  public.wallet_permissions,
  public.wallet_preferences
to service_role;

-- The trigger remains invocable by its owner on table updates. It must not
-- be published as an RPC to PUBLIC/anon/authenticated through PostgREST.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
grant execute on function public.set_updated_at() to service_role;

-- Stop postgres-created public tables/sequences from inheriting legacy
-- client grants by default. Existing explicit grants are handled above.
-- Function default EXECUTE for PUBLIC is a separate global PostgreSQL
-- behavior: every new function must revoke PUBLIC explicitly in its own
-- migration. supabase_admin-owned defaults cannot be changed by postgres;
-- see the documented residual provisioning risk in SEC-05.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

-- DB-02 (#1034): bounded, auditable retention for expired public shares and
-- ephemeral wallet-auth data. Saved Evaluations, saved Planner plans, wallet
-- preferences and bug reports are intentionally outside this policy.
create table if not exists public.private_data_retention_audit (
  run_bucket timestamptz primary key,
  last_ran_at timestamptz not null,
  evaluation_shares_deleted bigint not null default 0,
  planner_shares_deleted bigint not null default 0,
  wallet_auth_sessions_deleted bigint not null default 0,
  wallet_auth_consumed_challenges_deleted bigint not null default 0,
  wallet_auth_rate_limits_deleted bigint not null default 0
);

comment on table public.private_data_retention_audit is
  'DB-02 aggregate retention audit only. One row per UTC hour; no wallet, player, plan, report, token, nonce, IP or payload data. Rows are retained for 90 days.';

alter table public.private_data_retention_audit enable row level security;
revoke all on table public.private_data_retention_audit from public, anon, authenticated;
grant select, insert, update, delete on table public.private_data_retention_audit to service_role;

create or replace function public.run_private_data_retention()
returns table (
  evaluation_shares_deleted bigint,
  planner_shares_deleted bigint,
  wallet_auth_sessions_deleted bigint,
  wallet_auth_consumed_challenges_deleted bigint,
  wallet_auth_rate_limits_deleted bigint
)
language plpgsql
security invoker
set search_path = ''
as $db02$
declare
  v_now timestamptz := clock_timestamp();
  v_run_bucket timestamptz := date_trunc('hour', v_now);
  v_evaluation_shares_deleted bigint := 0;
  v_planner_shares_deleted bigint := 0;
  v_wallet_auth_sessions_deleted bigint := 0;
  v_wallet_auth_consumed_challenges_deleted bigint := 0;
  v_wallet_auth_rate_limits_deleted bigint := 0;
begin
  delete from public.evaluation_shares
  where expires_at <= v_now;
  get diagnostics v_evaluation_shares_deleted = row_count;

  delete from public.planner_shares
  where expires_at <= v_now;
  get diagnostics v_planner_shares_deleted = row_count;

  delete from public.wallet_auth_consumed_challenges
  where challenge_expires_at <= v_now;
  get diagnostics v_wallet_auth_consumed_challenges_deleted = row_count;

  delete from public.wallet_auth_sessions
  where expires_at <= v_now
     or (revoked_at is not null and revoked_at <= v_now - interval '1 day');
  get diagnostics v_wallet_auth_sessions_deleted = row_count;

  delete from public.wallet_auth_rate_limits
  where window_ends_at < v_now - interval '1 hour';
  get diagnostics v_wallet_auth_rate_limits_deleted = row_count;

  delete from public.private_data_retention_audit
  where run_bucket < v_run_bucket - interval '90 days';

  insert into public.private_data_retention_audit (
    run_bucket,
    last_ran_at,
    evaluation_shares_deleted,
    planner_shares_deleted,
    wallet_auth_sessions_deleted,
    wallet_auth_consumed_challenges_deleted,
    wallet_auth_rate_limits_deleted
  )
  values (
    v_run_bucket,
    v_now,
    v_evaluation_shares_deleted,
    v_planner_shares_deleted,
    v_wallet_auth_sessions_deleted,
    v_wallet_auth_consumed_challenges_deleted,
    v_wallet_auth_rate_limits_deleted
  )
  on conflict (run_bucket) do update
  set last_ran_at = excluded.last_ran_at,
      evaluation_shares_deleted =
        public.private_data_retention_audit.evaluation_shares_deleted
        + excluded.evaluation_shares_deleted,
      planner_shares_deleted =
        public.private_data_retention_audit.planner_shares_deleted
        + excluded.planner_shares_deleted,
      wallet_auth_sessions_deleted =
        public.private_data_retention_audit.wallet_auth_sessions_deleted
        + excluded.wallet_auth_sessions_deleted,
      wallet_auth_consumed_challenges_deleted =
        public.private_data_retention_audit.wallet_auth_consumed_challenges_deleted
        + excluded.wallet_auth_consumed_challenges_deleted,
      wallet_auth_rate_limits_deleted =
        public.private_data_retention_audit.wallet_auth_rate_limits_deleted
        + excluded.wallet_auth_rate_limits_deleted;

  return query
  select
    v_evaluation_shares_deleted,
    v_planner_shares_deleted,
    v_wallet_auth_sessions_deleted,
    v_wallet_auth_consumed_challenges_deleted,
    v_wallet_auth_rate_limits_deleted;
end;
$db02$;

revoke all on function public.run_private_data_retention()
  from public, anon, authenticated;
grant execute on function public.run_private_data_retention()
  to service_role;
