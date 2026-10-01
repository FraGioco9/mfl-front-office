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
