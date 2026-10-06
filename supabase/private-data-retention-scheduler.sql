-- DB-02 (#1034): production scheduler definition for private-data retention.
-- Apply only during an explicitly authorized Supabase maintenance/release step.
--
-- pg_cron evaluates this expression in the database timezone. The retention
-- predicates use timestamptz + clock_timestamp(), so DST/local-time changes do
-- not alter expiry semantics. Minute 41 avoids the existing MFL scheduler slots.
--
-- Re-running this file is safe: any existing job with the canonical name is
-- unscheduled before the replacement is registered.

select cron.unschedule(jobid)
from cron.job
where jobname = 'mfl-private-data-retention-hourly';

select cron.schedule(
  'mfl-private-data-retention-hourly',
  '41 * * * *',
  $$
  select public.run_private_data_retention();
  $$
);
