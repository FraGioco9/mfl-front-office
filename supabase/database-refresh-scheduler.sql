-- Sole production scheduler for Full database refresh.
-- Prerequisites:
--   1. Enable Supabase Cron (pg_cron), pg_net, and Vault in the MFL Supabase project.
--   2. Store these Vault secrets before running this file:
--        mfl_scheduler_project_url  -> https://<project-ref>.supabase.co
--        mfl_scheduler_shared_secret -> same random value as the Edge Function
--                                         SCHEDULER_SHARED_SECRET secret.
--   3. Deploy the mfl-database-refresh-dispatch Edge Function.
--
-- Rome alternates between UTC+1 and UTC+2. pg_cron evaluates schedules in UTC on
-- Supabase, so each local target has two possible UTC candidate hours. Each job
-- checks the intended minute plus one 10-minute recovery minute. SQL filters the
-- inactive CET/CEST candidates before any HTTP request. Normal result: six Edge
-- Function calls per day (three primary + three recovery checks), but only three
-- GitHub workflow dispatches. GitHub has no schedule trigger.

select cron.unschedule(jobid)
from cron.job
where jobname in (
  'mfl-database-refresh-1020',
  'mfl-database-refresh-1915',
  'mfl-database-refresh-2315',
  'mfl-database-refresh-1015',
  'mfl-database-refresh-1903',
  'mfl-database-refresh-2303'
);

select cron.schedule(
  'mfl-database-refresh-1020',
  '20,30 8,9 * * *',
  $$
  with schedule_context as (
    select to_char(timezone('Europe/Rome', now()), 'HH24:MI') as rome_hm
  )
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'mfl_scheduler_project_url'
      limit 1
    ) || '/functions/v1/mfl-database-refresh-dispatch',
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
      'target', '10:20',
      'recovery', rome_hm = '10:30'
    )
  )
  from schedule_context
  where rome_hm in ('10:20', '10:30');
  $$
);

select cron.schedule(
  'mfl-database-refresh-1903',
  '3,13 17,18 * * *',
  $$
  with schedule_context as (
    select to_char(timezone('Europe/Rome', now()), 'HH24:MI') as rome_hm
  )
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'mfl_scheduler_project_url'
      limit 1
    ) || '/functions/v1/mfl-database-refresh-dispatch',
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
      'target', '19:03',
      'recovery', rome_hm = '19:13'
    )
  )
  from schedule_context
  where rome_hm in ('19:03', '19:13');
  $$
);

select cron.schedule(
  'mfl-database-refresh-2303',
  '3,13 21,22 * * *',
  $$
  with schedule_context as (
    select to_char(timezone('Europe/Rome', now()), 'HH24:MI') as rome_hm
  )
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'mfl_scheduler_project_url'
      limit 1
    ) || '/functions/v1/mfl-database-refresh-dispatch',
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
      'target', '23:03',
      'recovery', rome_hm = '23:13'
    )
  )
  from schedule_context
  where rome_hm in ('23:03', '23:13');
  $$
);
