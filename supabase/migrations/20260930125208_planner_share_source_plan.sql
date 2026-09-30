alter table public.planner_shares
  add column if not exists source_plan_id text;

create index if not exists planner_shares_wallet_source_idx
  on public.planner_shares (wallet_address, source_plan_id, expires_at);
