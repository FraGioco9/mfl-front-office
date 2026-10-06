-- DB-05 (#1034): enforce the 50-saved-plan wallet cap atomically.
-- The existing application pre-check remains a fast user-facing guard; this
-- trigger is the database-level race guard for concurrent creates.

create or replace function public.enforce_planner_plan_wallet_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $db05$
declare
  v_plan_count integer := 0;
begin
  -- Serialize inserts only for the same wallet. The lock is transaction-scoped
  -- and hash collisions can only cause harmless extra serialization.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.wallet_address, 1034)
  );

  select count(*)::integer
  into v_plan_count
  from public.planner_plans
  where wallet_address = new.wallet_address;

  if v_plan_count >= 50 then
    raise exception using
      errcode = 'P0001',
      message = 'planner_plan_limit_exceeded';
  end if;

  return new;
end;
$db05$;

revoke all on function public.enforce_planner_plan_wallet_limit()
  from public, anon, authenticated;
grant execute on function public.enforce_planner_plan_wallet_limit()
  to service_role;

drop trigger if exists planner_plans_wallet_limit_guard
  on public.planner_plans;

create trigger planner_plans_wallet_limit_guard
before insert on public.planner_plans
for each row
execute function public.enforce_planner_plan_wallet_limit();
