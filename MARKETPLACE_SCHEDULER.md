# Reliable Marketplace Snapshot Scheduler

The production clock for `MFL marketplace snapshot` is **Supabase Cron only**. GitHub Actions has no `schedule:` trigger for Marketplace production runs; scheduled work reaches GitHub through `workflow_dispatch`.

## Europe/Rome cadence

- Incremental Marketplace snapshot every 15 minutes: `:00`, `:15`, `:30`, `:45`.
- The single exception is **04:00 Europe/Rome**, which runs the complete Marketplace `reconcile` refresh.
- After the complete refresh, incremental snapshots resume at 04:15, 04:30, 04:45, 05:00, and so on.
- Each intended occurrence has a Supabase recovery check five minutes later.

## Scheduler ownership

Supabase owns the schedule. GitHub is only the execution engine. The Marketplace workflow keeps manual `workflow_dispatch` and its existing push behavior, but it does not schedule itself.

Supabase Cron runs one job at:

`0,5,15,20,30,35,45,50 * * * *`

The quarter-hour minutes are primary calls. `:05`, `:20`, `:35`, and `:50` are recovery calls for the preceding quarter-hour.

Because Europe/Rome is always an integer-hour offset from UTC, the minute-of-hour is identical in UTC, CET, and CEST. SQL calculates the actual `Europe/Rome` timestamp before calling the Edge Function. The Edge Function independently validates the quarter-hour target and assigns:

- `04:00` -> `reconcile`
- every other quarter-hour -> `incremental`

Occurrence keys include the Rome UTC offset. This keeps the two repeated 02:xx hours distinct when DST ends while requiring no manual clock changes.

## Architecture

1. Supabase Cron runs the primary/recovery minute pattern.
2. SQL derives the intended Rome quarter-hour and invokes `mfl-marketplace-dispatch`.
3. The Edge Function authenticates with the existing scheduler shared secret.
4. The Edge Function validates the Rome occurrence and derives the Marketplace mode.
5. Primary calls dispatch `mfl-marketplace-snapshot.yml` through GitHub `workflow_dispatch`.
6. Five minutes later, recovery checks recent workflow runs for the occurrence key. An active or successful run suppresses the recovery dispatch; a missing or quickly failed run can be dispatched again.
7. GitHub updates and publishes Marketplace state exactly as before.

## Reused scheduler credentials

This scheduler reuses the secure credentials already installed for the Full database refresh scheduler:

- Edge Function secret `GITHUB_ACTIONS_DISPATCH_TOKEN`
- Edge Function secret `SCHEDULER_SHARED_SECRET`
- Vault secret `mfl_scheduler_project_url`
- Vault secret `mfl_scheduler_shared_secret`

No secret values belong in Git.

## Activation after merge

Deploy the Marketplace Edge Function:

```bash
supabase functions deploy mfl-marketplace-dispatch
```

Then run:

`supabase/marketplace-snapshot-scheduler.sql`

The SQL removes known old Marketplace Cron job names before installing the single `mfl-marketplace-snapshot-quarter-hour` job.

## Verification

In Supabase **Integrations -> Cron**, confirm `mfl-marketplace-snapshot-quarter-hour` is active. Its run history should show eight lightweight Cron executions each hour: four primary calls and four recovery calls.

In GitHub Actions, scheduled Marketplace runs should be `workflow_dispatch` runs whose title contains an occurrence key such as `20260827-0515-p0200`. There should be no GitHub `schedule` event for the Marketplace workflow.

At 04:00 Rome the dispatched mode must be `reconcile`; all other scheduled quarter-hours must be `incremental`.
