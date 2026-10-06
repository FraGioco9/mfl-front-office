# DB-03 — Schema, grants and migration drift

Issue: #1034  
Audit date: 2026-10-06

DB-03 makes database drift explicit without applying changes to production.

## Read-only findings

The production audit compared:

- `supabase-schema.sql`;
- all versioned repository migrations;
- `supabase_migrations.schema_migrations`;
- public tables/columns;
- constraints and indexes;
- functions/RPCs and trigger definitions;
- table/function grants;
- RLS state and policies.

No production DDL/DML was executed.

### Migration history

All repository/live migrations sharing the same version are semantically equal
after normalizing comments and whitespace. The wallet-auth migration is also
semantically equal but has a historical version alias:

- repository: `20260914150000_wallet_auth_sessions.sql`;
- production history: `20260914202553 wallet_auth_sessions`.

The versioned ledger is `docs/db03-schema-drift-ledger.json`. Repository
migrations are pinned by Git blob SHA-1, making any later edit to an already
inventoried migration fail CI.

The ledger records historical live-only migration **metadata only**. It
deliberately does not copy their SQL statements because historical migrations may
contain one-off data/backfill material and are not the canonical replay source.

### Intentionally staged drift

Two migrations are in Git but intentionally not live yet:

- SEC-05: `20261001172000_restrict_application_grants.sql`;
- DB-02: `20261006183000_private_data_retention.sql`.

This is release staging, not accidental drift.

### Legacy agent-name drift

Production still contains legacy duplicated agent-name state:

- `wallet_preferences.agent_name`: 110 non-empty rows of 112;
- `wallet_permissions.agent_name`: 2 non-empty rows of 4;
- functions:
  - `sync_wallet_preferences_agent_name_from_opt_ins()`;
  - `fill_wallet_preferences_agent_name_from_opt_ins()`;
- triggers:
  - `wallet_opt_ins_sync_preferences_agent_name`;
  - `wallet_preferences_fill_agent_name`.

The current application contract assigns agent-name ownership to
`wallet_opt_ins.agent_name`. The canonical schema therefore does **not** restore
those legacy columns/functions/triggers.

DB-03 does not drop them from production. Reconciliation requires a separately
reviewed migration after verifying that no remaining runtime path consumes the
duplicates.

### Grants

Production grant drift is expected until SEC-05 is applied. The target canonical
restore verifies:

- RLS enabled on every application table;
- zero browser-facing RLS policies;
- `anon` and `authenticated` denied direct table access;
- service role table access preserved;
- browser roles denied RPC execution;
- service-role RPC execution preserved.

### Planner contract

Both production catalog inspection and the isolated target restore verify:

- `planner_plans.revision integer not null default 1`;
- `planner_shares.source_plan_id -> planner_plans.id ON DELETE CASCADE`;
- unique `planner_shares(wallet_address, source_plan_id)`;
- an update using revision 1 succeeds once and advances to revision 2;
- a second stale revision-1 update/delete affects zero rows;
- deleting with the current revision succeeds and cascades to its share.

The application maps those zero-row stale CAS writes to HTTP 409, which remains
covered by the Planner persistence/concurrency validators.

## Read-only inventory

`scripts/supabase/db03-live-readonly-inventory.sql` contains only `SHOW` and
`SELECT` statements. It inventories migration fingerprints, public schema,
constraints, indexes, RPC fingerprints, triggers, grants and RLS.

The source validator rejects the file if any INSERT/UPDATE/DELETE/DDL/grant
statement is introduced.

## Isolated restore

`.github/workflows/db-03-schema-drift.yml` starts PostgreSQL 17 and:

1. verifies migration fingerprints and ledger coverage;
2. creates only Supabase-like test roles;
3. restores the historical season-ratio table from its dedicated repo migration;
4. restores the current canonical target schema;
5. validates RLS/grants/RPCs/constraints and Planner CAS;
6. runs the read-only inventory against that isolated database to catch SQL drift.

It never contacts the Supabase project and never needs production secrets.

## Release interpretation

A green DB-03 workflow means the **repository target state** is internally
replayable and its drift assumptions are explicit. It does not mean SEC-05,
DB-02, or a future legacy-agent cleanup has been applied live.

Any future production reconciliation remains a separate explicit authorization,
with backup/PITR and post-apply verification.
