-- Sole production scheduler for Marketplace snapshots.
-- Prerequisites:
--   1. Enable Supabase Cron (pg_cron), pg_net, and Vault in the MFL Supabase project.
--   2. Reuse the existing Vault secrets created for the database scheduler:
--        mfl_scheduler_project_url
--        mfl_scheduler_shared_secret
--   3. Deploy the mfl-marketplace-dispatch Edge Function with the same
--      GITHUB_ACTIONS_DISPATCH_TOKEN and SCHEDULER_SHARED_SECRET secrets.
--
-- The Cron job runs at every quarter-hour plus a five-minute recovery check.
-- Rome is UTC+1/UTC+2, so its minute-of-hour is identical to UTC throughout the
-- year. SQL derives the intended Europe/Rome quarter-hour and the Edge Function
-- validates the occurrence again before dispatching GitHub.

select cron.unschedule(jobid)
from cron.job
where jobname in (
  'mfl-marketplace-snapshot',
  'mfl-marketplace-hourly',
  'mfl-marketplace-quarter-hour',
  'mfl-marketplace-snapshot-quarter-hour'
);

select cron.schedule(
  'mfl-marketplace-snapshot-quarter-hour',
  '0,5,15,20,30,35,45,50 * * * *',
  $$
  with schedule_context as (
    select timezone('Europe/Rome', now()) as rome_now
  ),
  occurrence as (
    select
      to_char(
        case
          when extract(minute from rome_now)::int in (5, 20, 35, 50)
            then rome_now - interval '5 minutes'
          else rome_now
        end,
        'HH24:MI'
      ) as target,
      extract(minute from rome_now)::int in (5, 20, 35, 50) as recovery
    from schedule_context
  )
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'mfl_scheduler_project_url'
      limit 1
    ) || '/functions/v1/mfl-marketplace-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-scheduler-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'mfl_scheduler_shared_secret'
        limit 1
      )
    ),
    body := jsonb_build_object(
      'target', target,
      'recovery', recovery
    )
  )
  from occurrence;
  $$
);
