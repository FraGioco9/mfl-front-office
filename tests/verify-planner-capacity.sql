\set ON_ERROR_STOP on

-- Sequential boundary: the 50th plan is accepted and the 51st is rejected.
truncate table public.planner_shares, public.planner_plans;

set role service_role;
insert into public.planner_plans (id,wallet_address,club_id,name,payload,revision)
select
  'a' || lpad(g::text,15,'0'),
  '0x2222222222222222',
  '9001',
  'Plan ' || g,
  '{}'::jsonb,
  1
from generate_series(1,50) g;
reset role;

do $db05$
declare
  rejected boolean := false;
begin
  begin
    set local role service_role;
    insert into public.planner_plans(id,wallet_address,club_id,name,payload,revision)
    values ('afffffffffffffff','0x2222222222222222','9001','Plan 51','{}'::jsonb,1);
  exception
    when raise_exception then
      if sqlerrm = 'planner_plan_limit_exceeded' then
        rejected := true;
      else
        raise;
      end if;
  end;
  if not rejected then
    raise exception 'DB-05 accepted a 51st saved plan';
  end if;
end;
$db05$;

do $db05$
declare
  n integer;
begin
  select count(*) into n from public.planner_plans
  where wallet_address='0x2222222222222222';
  if n <> 50 then raise exception 'DB-05 sequential cap mismatch: %', n; end if;
end;
$db05$;

-- CAS and linked-share cascade remain correct under the new insert guard.
set role service_role;
insert into public.planner_plans(id,wallet_address,club_id,name,payload,revision)
values ('bbbbbbbbbbbbbbbb','0x3333333333333333','9001','CAS plan','{}'::jsonb,1);
insert into public.planner_shares(id,wallet_address,source_plan_id,club_id,name,payload,expires_at)
values ('cccccccccccccccc','0x3333333333333333','bbbbbbbbbbbbbbbb','9001','CAS share','{}'::jsonb,now()+interval '1 day');
reset role;

do $db05$
declare
  changed integer;
begin
  set local role service_role;

  update public.planner_plans
  set name='Revision 2', revision=2
  where id='bbbbbbbbbbbbbbbb' and wallet_address='0x3333333333333333' and revision=1;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'DB-05 current revision update failed'; end if;

  update public.planner_plans
  set name='Stale', revision=2
  where id='bbbbbbbbbbbbbbbb' and wallet_address='0x3333333333333333' and revision=1;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'DB-05 stale rename modified a row'; end if;

  delete from public.planner_plans
  where id='bbbbbbbbbbbbbbbb' and wallet_address='0x3333333333333333' and revision=1;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'DB-05 stale delete removed a row'; end if;

  delete from public.planner_plans
  where id='bbbbbbbbbbbbbbbb' and wallet_address='0x3333333333333333' and revision=2;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'DB-05 current revision delete failed'; end if;

  if exists (select 1 from public.planner_shares where source_plan_id='bbbbbbbbbbbbbbbb') then
    raise exception 'DB-05 linked share did not cascade';
  end if;
end;
$db05$;

select 'DB05_SEQUENTIAL_CAS_CASCADE_PASS' as result;
