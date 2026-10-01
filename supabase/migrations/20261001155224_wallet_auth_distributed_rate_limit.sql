-- SEC-03 (#1034): shared, atomic wallet authentication throttling.
-- Store only HMAC-SHA256 keys (derived from trusted client IP, operation and service secret).
create table if not exists public.wallet_auth_rate_limits (
  bucket_key text primary key,
  hits integer not null,
  window_ends_at timestamptz not null,
  constraint wallet_auth_rate_limits_key_check check (bucket_key ~ '^[0-9a-f]{64}$'),
  constraint wallet_auth_rate_limits_hits_check check (hits > 0)
);

create index if not exists wallet_auth_rate_limits_expiry_idx
  on public.wallet_auth_rate_limits (window_ends_at);

alter table public.wallet_auth_rate_limits enable row level security;
revoke all on table public.wallet_auth_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.wallet_auth_rate_limits to service_role;

create or replace function public.consume_wallet_auth_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_ends_at timestamptz;
begin
  if p_bucket_key is null or p_bucket_key !~ '^[0-9a-f]{64}$'
      or p_limit is null or p_limit < 1 or p_limit > 100
      or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 3600 then
    raise exception 'invalid wallet authentication rate-limit arguments';
  end if;

  -- Opportunistically remove old buckets; bounded indexed pruning avoids a separate cron dependency.
  if random() < 0.01 then
    delete from public.wallet_auth_rate_limits
    where window_ends_at < v_now - interval '1 hour';
  end if;

  insert into public.wallet_auth_rate_limits as buckets (bucket_key, hits, window_ends_at)
  values (p_bucket_key, 1, v_now + make_interval(secs => p_window_seconds))
  on conflict (bucket_key) do update
    set hits = case when buckets.window_ends_at <= v_now then 1 else buckets.hits + 1 end,
        window_ends_at = case
          when buckets.window_ends_at <= v_now then v_now + make_interval(secs => p_window_seconds)
          else buckets.window_ends_at
        end
    where buckets.window_ends_at <= v_now or buckets.hits < p_limit
  returning buckets.window_ends_at into v_ends_at;

  if found then
    return query select true, 0;
    return;
  end if;

  select buckets.window_ends_at into v_ends_at
  from public.wallet_auth_rate_limits as buckets
  where buckets.bucket_key = p_bucket_key;

  return query select false,
    greatest(1, least(p_window_seconds, ceil(extract(epoch from (v_ends_at - clock_timestamp())))::integer));
end;
$$;

revoke all on function public.consume_wallet_auth_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_wallet_auth_rate_limit(text, integer, integer)
  to service_role;
