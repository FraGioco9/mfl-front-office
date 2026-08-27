# Reliable Full Database Refresh Scheduler

The production clock for `Full database refresh` is **Supabase Cron only**. GitHub Actions no longer has a `schedule:` trigger for this workflow; GitHub is only the execution engine reached through `workflow_dispatch`.

## Intended Europe/Rome times

- 10:20
- 19:15
- 23:15

Each occurrence also has a Supabase-native recovery check 10 minutes later. The recovery check is not a second scheduler: it is part of the same Supabase Cron authority and only dispatches GitHub when the intended occurrence does not already have an active or successful workflow run.

## DST-safe Supabase schedule

Supabase `pg_cron` schedules in UTC, while Rome alternates between CET (UTC+1) and CEST (UTC+2). Each Rome target therefore has two possible UTC hours across the year:

- 10:20 Rome -> 08:20 UTC in CEST or 09:20 UTC in CET
- 19:15 Rome -> 17:15 UTC in CEST or 18:15 UTC in CET
- 23:15 Rome -> 21:15 UTC in CEST or 22:15 UTC in CET

The SQL evaluates both candidate UTC hours for the primary minute and the +10 minute recovery check, then checks `timezone('Europe/Rome', now())` **before** making an HTTP request. The inactive CET/CEST candidates exit inside Postgres.

Normal daily behavior is therefore:

- three primary Edge Function calls at 10:20, 19:15 and 23:15 Rome time;
- three recovery Edge Function calls at 10:30, 19:25 and 23:25 Rome time;
- exactly three GitHub workflow dispatches when every primary trigger succeeds.

No manual DST changes are required.

## Architecture

1. Supabase Cron evaluates the DST-safe UTC candidates for each primary and recovery minute.
2. SQL checks the actual `Europe/Rome` local time before invoking the Edge Function.
3. The primary call invokes `mfl-database-refresh-dispatch` at the intended time.
4. The Edge Function authenticates the scheduler request with a dedicated shared secret.
5. The Edge Function independently revalidates the Rome occurrence and dispatches GitHub through `workflow_dispatch`.
6. Ten minutes later, Supabase invokes the same Edge Function with `recovery=true`.
7. The recovery call queries recent `workflow_dispatch` runs for the occurrence key. If an active or successful run already exists, it exits without dispatching. If no qualifying run exists, it dispatches the missed occurrence.
8. GitHub runs the existing Full database refresh pipeline; it does not schedule itself.
9. A successful scheduled occurrence uploads `full-database-refresh-occurrence-<YYYYMMDD-HHMM>` so ambiguous retries or later duplicate dispatches cannot rebuild an already completed occurrence.

## GitHub dispatch reliability

GitHub API calls from the Edge Function retry up to three times for transient failures:

- network failures;
- HTTP 429;
- HTTP 5xx.

Permanent GitHub API errors such as invalid credentials or permissions fail immediately instead of being retried blindly.

A rare ambiguous retry can result in more than one GitHub dispatch request if a request reached GitHub but its response was lost. The workflow occurrence marker and shared concurrency gate make those duplicates safe. The +10 minute recovery check additionally avoids creating a routine duplicate when the primary run is already queued, in progress, or successful.

A completed failed run does **not** suppress recovery. This allows the +10 check to dispatch again when the primary GitHub run failed quickly before recovery time.

## One-time setup in the MFL Supabase project

### 1. Create a narrow GitHub token

Create a fine-grained personal access token restricted to **FraGioco9/mfl-front-office** with only:

- Repository permission: **Actions — Read and write**

The recovery check uses Actions read access, and workflow dispatch uses Actions write access. No Contents write permission is required.

Store it in **Supabase -> Edge Functions -> Secrets** as:

`GITHUB_ACTIONS_DISPATCH_TOKEN`

### 2. Create a scheduler shared secret

Generate a long random secret (32+ bytes is recommended). Store the same value in two places:

- Edge Function secret: `SCHEDULER_SHARED_SECRET`
- Supabase Vault secret named: `mfl_scheduler_shared_secret`

Also store the MFL Supabase project URL in Vault as `mfl_scheduler_project_url`.

Example SQL in the Supabase SQL Editor:

```sql
select vault.create_secret(
  'https://<project-ref>.supabase.co',
  'mfl_scheduler_project_url'
);

select vault.create_secret(
  '<same-random-shared-secret>',
  'mfl_scheduler_shared_secret'
);
```

Do not commit either secret to Git.

### 3. Deploy the Edge Function

The function source is:

`supabase/functions/mfl-database-refresh-dispatch/`

Its JWT platform check is disabled because the endpoint implements its own shared-secret authentication. `supabase/config.toml` records that setting.

Using the current Supabase CLI:

```bash
supabase link --project-ref <MFL_PROJECT_REF>
supabase functions deploy mfl-database-refresh-dispatch
supabase secrets set GITHUB_ACTIONS_DISPATCH_TOKEN=<token> SCHEDULER_SHARED_SECRET=<secret>
```

### 4. Enable and install Cron

Enable **Cron**, `pg_net`, and Vault for the MFL Supabase project, then run:

`supabase/database-refresh-scheduler.sql`

It creates three jobs:

- `mfl-database-refresh-1020` -> primary 10:20 + recovery 10:30 Rome time
- `mfl-database-refresh-1915` -> primary 19:15 + recovery 19:25 Rome time
- `mfl-database-refresh-2315` -> primary 23:15 + recovery 23:25 Rome time

Each job covers both CET and CEST UTC hours. SQL rejects the inactive UTC candidate before it can call the Edge Function.

## Verification

### Supabase

In **Integrations -> Cron**, confirm the three jobs are enabled and inspect their run history.

Each job has four lightweight Postgres Cron executions per day because both CET/CEST hours are evaluated for both the primary and recovery minute. Only two executions per job should produce a `net.http_post` request ID: the real Rome primary minute and its +10 recovery minute.

Check Edge Function logs for `mfl-database-refresh-dispatch`:

- primary success should report `dispatched: true`, `recovery: false`;
- normal recovery should report `dispatched: false`, `reason: occurrence_already_present`;
- a recovered missed primary should report `dispatched: true`, `recovery: true`.

### GitHub

Open **Actions -> Full database refresh**. Scheduled production runs should be `workflow_dispatch` runs with `trigger_source=supabase-cron` and an occurrence key such as `20260827-1915`.

There should be **no GitHub `schedule` event** for Full database refresh after this change.

On a healthy day there should still be only one GitHub refresh run per occurrence; the recovery check happens in Supabase and exits before dispatch when the primary run exists.

The timing summary records:

- trigger source;
- intended Europe/Rome time;
- Supabase trigger time;
- GitHub workflow creation time;
- database job start time;
- trigger delay;
- queue/concurrency delay;
- total start delay.

A recovered occurrence will naturally show roughly 10 minutes of trigger delay, making recovery visible in GitHub telemetry.

## Failure behavior

- **Transient GitHub API/network problem:** the Edge Function retries the GitHub request up to three times.
- **Primary Supabase Cron execution is missed or its dispatch never creates a GitHub run:** the +10 minute Supabase recovery check dispatches the same occurrence.
- **Primary GitHub run is queued, running, or already successful:** recovery exits without creating another GitHub run.
- **Primary GitHub run fails before the +10 recovery check:** recovery is allowed to dispatch the occurrence again.
- **Permanent GitHub API error:** the Edge Function fails and records the error in its logs; the recovery check provides one later attempt but will also fail until the underlying credential/permission problem is fixed.
- **Supabase Cron is unavailable across both primary and recovery checks:** there is intentionally no second scheduler. The occurrence can be started manually from GitHub Actions.
- **Duplicate/ambiguous external dispatch:** shared workflow concurrency serializes it and the completion marker prevents a second successful rebuild of the same occurrence.
- **Manual run:** GitHub's `workflow_dispatch` remains available for recovery and maintenance, but it is not a scheduler.

This intentionally uses one production scheduling authority: **Supabase Cron**.
