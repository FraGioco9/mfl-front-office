# DB-02 — Private-data retention

Issue: #1034  
Date: 2026-10-06  
Mode: implementation staged in Git only; **not applied to Supabase**

## Read-only production baseline

The live audit was aggregate-only and did not retrieve wallet addresses, payloads,
share IDs, report text, tokens, nonces, IP-derived hashes or other user content.

| Dataset | Total | Eligible now | Active / preserved |
| --- | ---: | ---: | ---: |
| Evaluation shares | 16 | 2 expired | 14 |
| Planner shares | 6 | 0 expired | 6 |
| Wallet sessions | 16 | 4 expired/revoked | 12 active |
| Consumed wallet challenges | 1 | 1 expired | 0 |
| Wallet auth rate-limit buckets | 18 | 18 older than window + 1 hour | 0 current |
| Bug reports | 0 | n/a | 0 |
| Saved Evaluations | 17 | **never automatic** | 17 |
| Saved Planner plans | 1 | **never automatic** | 1 |

There is no retention cron job in production today. Existing wallet-session and
rate-limit cleanup is opportunistic, so stale rows can remain when no later
request triggers the cleanup path.

## Retention contract

`public.run_private_data_retention()` uses one database timestamp
(`clock_timestamp()`) for the whole run.

- Evaluation share: delete at `expires_at <= now`.
- Planner share: delete at `expires_at <= now`.
- Consumed wallet challenge: delete at `challenge_expires_at <= now`.
- Wallet session: delete at expiry, or one day after revocation.
- Wallet auth rate-limit bucket: delete one hour after its window ends.
- Aggregate retention audit: retain 90 days.

The following are explicitly excluded from automatic retention:

- `evaluation_saves`
- `planner_plans`
- `wallet_preferences`
- `wallet_opt_ins`
- `wallet_permissions`
- `bug_reports`

Bug reports are excluded because `created_at` is not a safe proxy for resolved
or closed state. A future bug-report TTL requires a reliable lifecycle timestamp.

## Audit design

`private_data_retention_audit` contains one row per UTC hour and stores only:

- run bucket;
- last run timestamp;
- deletion count for each eligible dataset.

It never stores wallet, player, plan, report, token, nonce, IP, user-agent or
payload data. A retry in the same hour updates the same audit bucket and adds only
the new deletion counts.

## Scheduling

`supabase/private-data-retention-scheduler.sql` replaces only the canonical
`mfl-private-data-retention-hourly` pg_cron job and schedules it for minute 41
of each hour.

The retention predicates compare `timestamptz` values to the database clock, so
CET/CEST transitions do not change the expiration instant. No HTTP request,
Vault secret, Vercel deployment or GitHub workflow is involved.

## Index evidence

- `evaluation_shares_expires_at_idx`: 916 observed scans; EXPLAIN selects it for
  expired-share deletion. Keep.
- `planner_shares_expires_at_idx`: planner currently prefers a sequential scan
  with only six rows. Keep while retention/growth establishes real workload.
- `wallet_auth_rate_limits_expiry_idx`: EXPLAIN selects it for the DB-02
  expiration predicate. Keep.
- `wallet_auth_sessions_wallet_expiry_idx`: still the only strong DB-01 drop
  candidate, but DB-02 does not remove it; index removal remains a separate,
  evidence-backed change.

## Safety fixture

`tests/test_db02_retention_policy.mjs` verifies:

- the SQL DELETE target set is allow-listed;
- saved Evaluations, saved Planner plans, preferences/opt-in/permissions and bug
  reports cannot be cleanup targets;
- exact TTL boundaries including equality at expiry;
- one-day revoked-session grace and one-hour rate-limit grace;
- equivalent UTC / Europe-Rome instants;
- active share/session/challenge/rate-limit rows remain;
- a second identical cleanup deletes zero additional rows;
- a snapshot of protected user data is byte-for-byte unchanged;
- the audit schema has no private identifiers or payload fields;
- Planner Revoke and active-share filters remain present;
- the scheduler is database-local and idempotently replaces only its named job.

This is an isolated source/fixture test. It does not require Docker and does not
connect to the production database.

## Release / backup gate

DB-02 must not be applied merely because this PR is merged.

Before live application:

1. export aggregate eligibility counts and min/max expiry timestamps;
2. verify the normal Supabase backup/PITR recovery point;
3. apply the schema migration;
4. invoke `run_private_data_retention()` once and compare returned counts with
   the preflight report;
5. smoke-test active Evaluation/Planner share reads, Planner Revoke, wallet
   session resolution and rate limiting;
6. only after those checks, install the hourly scheduler;
7. confirm aggregate audit and pg_cron execution status.

If rollback is needed, disable the cron job first. Deleted private payload rows
are restored from backup/PITR, not from the aggregate audit table.
