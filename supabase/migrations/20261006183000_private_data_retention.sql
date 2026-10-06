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
