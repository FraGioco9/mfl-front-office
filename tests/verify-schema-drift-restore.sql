\set ON_ERROR_STOP on

do $db03$
declare
  expected_tables text[] := array[
    'bug_reports',
    'evaluation_saves',
    'evaluation_shares',
    'mfl_season_ratios',
    'planner_plans',
    'planner_shares',
    'private_data_retention_audit',
    'wallet_auth_consumed_challenges',
    'wallet_auth_rate_limits',
    'wallet_auth_sessions',
    'wallet_opt_ins',
    'wallet_permissions',
    'wallet_preferences'
  ];
  actual_tables text[];
  table_name text;
begin
  select array_agg(c.relname order by c.relname)
  into actual_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p');

  if actual_tables is distinct from expected_tables then
    raise exception 'DB-03 public table inventory mismatch: %', actual_tables;
  end if;

  foreach table_name in array expected_tables loop
    if not (select relrowsecurity
            from pg_class c join pg_namespace n on n.oid=c.relnamespace
            where n.nspname='public' and c.relname=table_name) then
      raise exception 'DB-03 RLS disabled on %', table_name;
    end if;
    if exists (select 1 from pg_policies where schemaname='public' and tablename=table_name) then
      raise exception 'DB-03 unexpected RLS policy on %', table_name;
    end if;
    if has_table_privilege('anon', format('public.%I', table_name), 'SELECT,INSERT,UPDATE,DELETE')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'DB-03 browser role unexpectedly has table privileges on %', table_name;
    end if;
    if not has_table_privilege('service_role', format('public.%I', table_name), 'SELECT') then
      raise exception 'DB-03 service_role lacks SELECT on %', table_name;
    end if;
  end loop;
end;
$db03$;

do $db03$
declare
  fn record;
begin
  for fn in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f'
  loop
    if has_function_privilege('anon', fn.oid, 'EXECUTE')
       or has_function_privilege('authenticated', fn.oid, 'EXECUTE')
       or not has_function_privilege('service_role', fn.oid, 'EXECUTE') then
      raise exception 'DB-03 inappropriate function grants on %', fn.proname;
    end if;
  end loop;
end;
$db03$;

do $db03$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name in ('wallet_preferences','wallet_permissions')
      and column_name='agent_name'
  ) then
    raise exception 'DB-03 canonical restore reintroduced legacy agent_name duplication';
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in ('sync_wallet_preferences_agent_name_from_opt_ins','fill_wallet_preferences_agent_name_from_opt_ins')
  ) then
    raise exception 'DB-03 canonical restore reintroduced legacy agent-name functions';
  end if;

  if exists (
    select 1 from information_schema.triggers
    where trigger_schema='public'
      and trigger_name in ('wallet_opt_ins_sync_preferences_agent_name','wallet_preferences_fill_agent_name')
  ) then
    raise exception 'DB-03 canonical restore reintroduced legacy agent-name triggers';
  end if;
end;
$db03$;

do $db03$
declare
  revision_default text;
begin
  select column_default into revision_default
  from information_schema.columns
  where table_schema='public' and table_name='planner_plans' and column_name='revision';

  if revision_default is distinct from '1' then
    raise exception 'DB-03 planner revision default mismatch: %', revision_default;
  end if;

  if not exists (
    select 1 from pg_constraint con
    join pg_class c on c.oid=con.conrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='planner_shares'
      and con.contype='f'
      and pg_get_constraintdef(con.oid,true) =
        'FOREIGN KEY (source_plan_id) REFERENCES planner_plans(id) ON DELETE CASCADE'
  ) then
    raise exception 'DB-03 planner source-plan cascade FK missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and tablename='planner_shares'
      and indexname='planner_shares_wallet_source_idx'
      and indexdef ilike 'CREATE UNIQUE INDEX%'
  ) then
    raise exception 'DB-03 planner wallet/source unique index missing';
  end if;
end;
$db03$;

begin;
insert into public.planner_plans(id,wallet_address,club_id,name,payload,revision)
values ('db03plan00000001','0x0123456789abcdef','9001','DB-03 fixture','{}'::jsonb,1);

insert into public.planner_shares(id,wallet_address,source_plan_id,club_id,name,payload,expires_at)
values ('db03share0000001','0x0123456789abcdef','db03plan00000001','9001','DB-03 fixture','{}'::jsonb,now()+interval '1 day');

do $db03$
declare
  changed integer;
begin
  update public.planner_plans
  set name='DB-03 revision 2', revision=2
  where id='db03plan00000001' and wallet_address='0x0123456789abcdef' and revision=1;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'DB-03 CAS initial update failed'; end if;

  update public.planner_plans
  set name='stale write', revision=2
  where id='db03plan00000001' and wallet_address='0x0123456789abcdef' and revision=1;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'DB-03 stale CAS unexpectedly updated a row'; end if;

  delete from public.planner_plans
  where id='db03plan00000001' and wallet_address='0x0123456789abcdef' and revision=1;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'DB-03 stale CAS unexpectedly deleted a row'; end if;

  delete from public.planner_plans
  where id='db03plan00000001' and wallet_address='0x0123456789abcdef' and revision=2;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'DB-03 current-revision delete failed'; end if;

  if exists (select 1 from public.planner_shares where source_plan_id='db03plan00000001') then
    raise exception 'DB-03 planner FK cascade failed';
  end if;
end;
$db03$;
rollback;

select 'DB03_ISOLATED_RESTORE_PASS' as result;
