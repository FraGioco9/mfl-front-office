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

  delete from public.wallet_auth_consumed_challenges as challenges
  where challenges.challenge_expires_at <= v_now;

  delete from public.wallet_auth_sessions as sessions
  where sessions.expires_at <= v_now
     or (sessions.revoked_at is not null and sessions.revoked_at <= v_now - interval '1 day');

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
