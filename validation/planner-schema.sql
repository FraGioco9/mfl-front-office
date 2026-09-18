-- Run after the Planner migration in a disposable database. All data rolls back.
begin;
set local role service_role;
insert into public.planner_plans (id, wallet_address, club_id, name, formation_id)
values ('11111111-1111-4111-8111-111111111111', '0x1111111111111111', '123', 'Test XI', '4-3-3');
do $$ begin
  if not exists (select 1 from public.planner_plans where id = '11111111-1111-4111-8111-111111111111' and visibility = 'private' and revision = 1) then
    raise exception 'New plan must default to private revision 1';
  end if;
  begin
    update public.planner_plans set visibility = 'public';
    raise exception 'Invalid visibility was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.planner_plans set assignments = '[]';
    raise exception 'Non-object assignments were accepted';
  exception when check_violation then null;
  end;
  begin
    update public.planner_plans set revision = 0;
    raise exception 'Invalid revision was accepted';
  exception when check_violation then null;
  end;
end $$;
update public.planner_plans set visibility = 'unlisted', revision = 2
where id = '11111111-1111-4111-8111-111111111111' and wallet_address = '0x1111111111111111' and revision = 1;
do $$ declare affected integer; begin
  update public.planner_plans set name = 'Stale save' where id = '11111111-1111-4111-8111-111111111111' and revision = 1;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Stale save overwrote newer revision'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform * from public.planner_plans;
    raise exception 'Anonymous role could read planner rows directly';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set local role authenticated;
do $$ begin
  begin
    update public.planner_plans set visibility = 'unlisted';
    raise exception 'Authenticated role could write planner rows directly';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  if not (select relrowsecurity from pg_class where oid = 'public.planner_plans'::regclass) then
    raise exception 'RLS must be enabled';
  end if;
end $$;
rollback;
