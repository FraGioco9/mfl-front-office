create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  summary text not null,
  area text not null,
  route text not null,
  reproduction text not null,
  expected_behavior text not null,
  actual_behavior text not null,
  environment text not null default '',
  evidence text not null default '',
  app_version text not null default '',
  user_agent text not null default '',
  wallet_address text,
  reporter_hash text not null,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  constraint bug_reports_summary_length_check check (char_length(summary) between 1 and 120),
  constraint bug_reports_area_check check (area in (
    'Database / MFL',
    'Club / Agent / Player pages',
    'Watchlist / My Players',
    'Evaluation',
    'Search / Filters',
    'Loading / Navigation',
    'Settings / Account',
    'Database builder / Data pipeline',
    'Other'
  )),
  constraint bug_reports_route_length_check check (char_length(route) between 1 and 300),
  constraint bug_reports_reproduction_length_check check (char_length(reproduction) between 1 and 4000),
  constraint bug_reports_expected_length_check check (char_length(expected_behavior) between 1 and 2000),
  constraint bug_reports_actual_length_check check (char_length(actual_behavior) between 1 and 2000),
  constraint bug_reports_environment_length_check check (char_length(environment) <= 300),
  constraint bug_reports_evidence_length_check check (char_length(evidence) <= 4000),
  constraint bug_reports_app_version_length_check check (char_length(app_version) <= 32),
  constraint bug_reports_user_agent_length_check check (char_length(user_agent) <= 512),
  constraint bug_reports_reporter_hash_check check (reporter_hash ~ '^[0-9a-f]{64}$'),
  constraint bug_reports_status_check check (status in ('new', 'triaged', 'planned', 'resolved', 'dismissed'))
);

create index if not exists bug_reports_reporter_created_idx
  on public.bug_reports (reporter_hash, created_at desc);

create index if not exists bug_reports_status_created_idx
  on public.bug_reports (status, created_at desc);

alter table public.bug_reports enable row level security;
revoke all on table public.bug_reports from anon, authenticated;
grant select, insert, update, delete on table public.bug_reports to service_role;
