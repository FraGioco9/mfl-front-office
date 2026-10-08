-- DB-03 (#1034): read-only live inventory.
-- This file contains SELECT/SHOW statements only. It is safe to use for an
-- explicit read-only audit and must never be changed to apply DDL/DML.

show timezone;

select version, name,
       md5(trim(regexp_replace(
         regexp_replace(replace(array_to_string(statements, E'\n'), E'\r\n', E'\n'),
                        '--[^\n]*', ' ', 'g'),
         '\s+', ' ', 'g'
       ))) as normalized_statements_md5
from supabase_migrations.schema_migrations
order by version;

select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  count(p.policyname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p
  on p.schemaname = n.nspname
 and p.tablename = c.relname
where n.nspname = 'public'
  and c.relkind in ('r','p')
group by n.nspname, c.relname, c.relrowsecurity
order by c.relname;

select
  c.relname as table_name,
  a.attname as column_name,
  pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type,
  a.attnotnull as not_null,
  pg_get_expr(ad.adbin, ad.adrelid) as default_expression
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid
left join pg_attrdef ad on ad.adrelid = c.oid and ad.adnum = a.attnum
where n.nspname = 'public'
  and c.relkind in ('r','p')
  and a.attnum > 0
  and not a.attisdropped
order by c.relname, a.attnum;

select
  c.relname as table_name,
  con.conname as constraint_name,
  con.contype as constraint_type,
  pg_get_constraintdef(con.oid, true) as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
order by c.relname, con.conname;

select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;

select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_args,
  p.prosecdef as security_definer,
  coalesce(array_to_string(p.proconfig, ','), '') as function_config,
  md5(pg_get_functiondef(p.oid)) as function_fingerprint
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
order by p.proname, identity_args;

select
  event_object_table as table_name,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
from information_schema.triggers
where trigger_schema = 'public'
order by event_object_table, trigger_name, event_manipulation;

select
  table_name,
  grantee,
  string_agg(privilege_type, ',' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon','authenticated','service_role')
group by table_name, grantee
order by table_name, grantee;

select
  routine_name,
  grantee,
  string_agg(privilege_type, ',' order by privilege_type) as privileges
from information_schema.role_routine_grants
where routine_schema = 'public'
  and grantee in ('PUBLIC','anon','authenticated','service_role')
group by routine_name, grantee
order by routine_name, grantee;
