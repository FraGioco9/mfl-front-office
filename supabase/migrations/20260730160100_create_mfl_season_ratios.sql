create table if not exists public.mfl_season_ratios (
  season integer primary key,
  ratio double precision not null check (ratio > 0)
);

alter table public.mfl_season_ratios enable row level security;

comment on table public.mfl_season_ratios is
  'Historical MFL per USD ratio for each completed MFL season.';
comment on column public.mfl_season_ratios.season is
  'MFL season number.';
comment on column public.mfl_season_ratios.ratio is
  'MFL tokens per USD for the season.';

insert into public.mfl_season_ratios (season, ratio)
values
  (1, 300),
  (2, 333),
  (3, 333),
  (4, 300),
  (5, 225),
  (6, 250),
  (7, 333),
  (8, 400),
  (9, 450),
  (10, 500),
  (11, 475),
  (12, 450),
  (13, 450),
  (14, 400)
on conflict (season) do update
set ratio = excluded.ratio;
