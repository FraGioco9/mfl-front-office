create table if not exists public.wallet_opt_ins (
  wallet_address text primary key,
  opted_in_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.wallet_permissions (
  wallet_address text primary key,
  can_view_progression boolean not null default false,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wallet_permissions_set_updated_at on public.wallet_permissions;
create trigger wallet_permissions_set_updated_at
before update on public.wallet_permissions
for each row
execute function public.set_updated_at();

alter table public.wallet_opt_ins enable row level security;
alter table public.wallet_permissions enable row level security;