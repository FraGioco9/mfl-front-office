with ranked as (
  select
    id,
    row_number() over (
      partition by wallet_address, source_plan_id
      order by created_at desc, id desc
    ) as duplicate_rank
  from public.planner_shares
  where source_plan_id is not null
)
delete from public.planner_shares as share
using ranked
where share.id = ranked.id
  and ranked.duplicate_rank > 1;

drop index if exists public.planner_shares_wallet_source_idx;

create unique index planner_shares_wallet_source_idx
  on public.planner_shares (wallet_address, source_plan_id);
