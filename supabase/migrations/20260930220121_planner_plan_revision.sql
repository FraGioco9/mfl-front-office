alter table public.planner_plans
  add column if not exists revision integer not null default 1;

delete from public.planner_shares as share
where share.source_plan_id is not null
  and not exists (
    select 1
    from public.planner_plans as plan
    where plan.id = share.source_plan_id
  );

alter table public.planner_shares
  drop constraint if exists planner_shares_source_plan_fk;

alter table public.planner_shares
  add constraint planner_shares_source_plan_fk
  foreign key (source_plan_id)
  references public.planner_plans(id)
  on delete cascade;
