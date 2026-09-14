create table if not exists public.wallet_auth_consumed_challenges (
  nonce text primary key,
  wallet_address text not null,
  challenge_expires_at timestamptz not null,
  consumed_at timestamptz not null default now(),
  constraint wallet_auth_consumed_challenges_nonce_check
    check (nonce ~ '^[0-9a-f]{64}$'),
  constraint wallet_auth_consumed_challenges_wallet_check
    check (wallet_address ~ '^0x[0-9a-f]{16}$')
);

create index if not exists wallet_auth_consumed_challenges_expiry_idx
  on public.wallet_auth_consumed_challenges (challenge_expires_at);

create table if not exists public.wallet_auth_sessions (
  session_hash text primary key,
  wallet_address text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint wallet_auth_sessions_hash_check
    check (session_hash ~ '^[0-9a-f]{64}$'),
  constraint wallet_auth_sessions_wallet_check
    check (wallet_address ~ '^0x[0-9a-f]{16}$'),
  constraint wallet_auth_sessions_expiry_check
    check (expires_at > created_at)
);

create index if not exists wallet_auth_sessions_wallet_expiry_idx
  on public.wallet_auth_sessions (wallet_address, expires_at desc);

create index if not exists wallet_auth_sessions_active_expiry_idx
  on public.wallet_auth_sessions (expires_at)
  where revoked_at is null;

alter table public.wallet_auth_consumed_challenges enable row level security;
alter table public.wallet_auth_sessions enable row level security;

revoke all on table public.wallet_auth_consumed_challenges from public, anon, authenticated;
revoke all on table public.wallet_auth_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.wallet_auth_consumed_challenges to service_role;
grant select, insert, update, delete on table public.wallet_auth_sessions to service_role;

create or replace function public.consume_wallet_challenge_and_create_session(
  p_nonce text,
  p_wallet_address text,
  p_challenge_expires_at timestamptz,
  p_session_hash text,
  p_session_expires_at timestamptz
)
returns table (
  wallet_address text,
  expires_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_inserted integer := 0;
begin
  if p_nonce is null or p_nonce !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid wallet challenge nonce';
  end if;
  if p_wallet_address is null or p_wallet_address !~ '^0x[0-9a-f]{16}$' then
    raise exception 'invalid wallet address';
  end if;
  if p_session_hash is null or p_session_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid wallet session hash';
  end if;
  if p_challenge_expires_at is null or p_challenge_expires_at <= v_now then
    return;
  end if;
  if p_session_expires_at is null
      or p_session_expires_at <= v_now
      or p_session_expires_at > v_now + interval '8 days' then
    raise exception 'invalid wallet session expiry';
  end if;

  delete from public.wallet_auth_consumed_challenges
  where challenge_expires_at <= v_now;

  delete from public.wallet_auth_sessions
  where expires_at <= v_now
     or (revoked_at is not null and revoked_at <= v_now - interval '1 day');

  insert into public.wallet_auth_consumed_challenges (
    nonce,
    wallet_address,
    challenge_expires_at
  )
  values (
    p_nonce,
    p_wallet_address,
    p_challenge_expires_at
  )
  on conflict (nonce) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted <> 1 then
    return;
  end if;

  insert into public.wallet_auth_sessions (
    session_hash,
    wallet_address,
    expires_at
  )
  values (
    p_session_hash,
    p_wallet_address,
    p_session_expires_at
  );

  return query
  select p_wallet_address, p_session_expires_at;
end;
$$;

create or replace function public.resolve_wallet_session(
  p_session_hash text
)
returns table (
  wallet_address text,
  expires_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select sessions.wallet_address, sessions.expires_at
  from public.wallet_auth_sessions as sessions
  where sessions.session_hash = p_session_hash
    and sessions.revoked_at is null
    and sessions.expires_at > statement_timestamp()
  limit 1;
$$;

create or replace function public.revoke_wallet_session(
  p_session_hash text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated integer := 0;
begin
  update public.wallet_auth_sessions
  set revoked_at = clock_timestamp()
  where session_hash = p_session_hash
    and revoked_at is null
    and expires_at > clock_timestamp();

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.consume_wallet_challenge_and_create_session(text, text, timestamptz, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.resolve_wallet_session(text)
  from public, anon, authenticated;
revoke all on function public.revoke_wallet_session(text)
  from public, anon, authenticated;

grant execute on function public.consume_wallet_challenge_and_create_session(text, text, timestamptz, text, timestamptz)
  to service_role;
grant execute on function public.resolve_wallet_session(text)
  to service_role;
grant execute on function public.revoke_wallet_session(text)
  to service_role;
