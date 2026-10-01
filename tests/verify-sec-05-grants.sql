-- SEC-05 (#1034): assertions for isolated PostgreSQL 17.
-- This script is run AFTER the staged grant-hardening migration.
do $sec_05$
declare
  rec record;
  table_count int := 0;
  fn record;
begin
  for rec in
    select c.oid, c.relname, c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p')
    order by c.relname
  loop
    table_count := table_count + 1;
    if not rec.relrowsecurity then
      raise exception 'SEC-05: missing RLS on %', rec.relname;
    end if;
    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = rec.relname
    ) then
      raise exception 'SEC-05: unexpected client policy on %', rec.relname;
    end if;
    if has_table_privilege('anon', rec.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
      or has_table_privilege('authenticated', rec.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') then
      raise exception 'SEC-05: client table grant remains on %', rec.relname;
    end if;
    if not has_table_privilege('service_role', rec.oid, 'SELECT')
      or not has_table_privilege('service_role', rec.oid, 'INSERT')
      or not has_table_privilege('service_role', rec.oid, 'UPDATE')
      or not has_table_privilege('service_role', rec.oid, 'DELETE') then
      raise exception 'SEC-05: service_role DML missing on %', rec.relname;
    end if;
  end loop;
  if table_count <> 12 then
    raise exception 'SEC-05: expected twelve audited tables, found %', table_count;
  end if;

  -- All application public-schema functions are server-only after the grant
  -- migration. Trigger functions are not executable as ordinary RPCs.
  for fn in
    select p.oid, p.proname
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
  loop
    if has_function_privilege('anon', fn.oid, 'EXECUTE')
      or has_function_privilege('authenticated', fn.oid, 'EXECUTE')
      or not has_function_privilege('service_role', fn.oid, 'EXECUTE') then
      raise exception 'SEC-05: inappropriate EXECUTE privilege on %', fn.proname;
    end if;
  end loop;
  if exists (
    select 1
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where p.oid = 'public.set_updated_at()'::regprocedure
      and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'SEC-05: PUBLIC can execute set_updated_at()';
  end if;
end;
$sec_05$;

select 'SEC-05: 12 RLS-denied tables; no client table/function grants; service_role retained' as result;
