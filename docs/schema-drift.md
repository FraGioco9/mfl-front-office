# Schema drift contract

This repository keeps the target Supabase schema reproducible without applying database changes from CI.

## Canonical sources

- `supabase-schema.sql` is the current target schema.
- `supabase/migrations/` contains versioned migrations.
- `docs/schema-drift-ledger.json` fingerprints every repository migration by Git blob SHA-1 and records known history aliases/metadata.
- `scripts/supabase/schema-drift-readonly-inventory.sql` is a read-only inventory query set.
- `tests/test_schema_drift_inventory.mjs` validates the ledger, canonical schema and read-only inventory contract.
- `.github/workflows/schema-drift.yml` restores the target into an isolated PostgreSQL 17 service and verifies grants, RLS, constraints and Planner CAS behavior.

## Safety boundary

The schema-drift workflow:

- uses only isolated PostgreSQL;
- never connects to the production Supabase project;
- needs no production secrets;
- does not apply migrations or DDL to production;
- accepts only `SHOW` / `SELECT` statements in the read-only inventory.

Production reconciliation is always a separate explicitly authorized action.

## Migration history

Already-versioned migration files are immutable. The ledger intentionally stores historical live-only migration **metadata**, not one-off SQL payloads.

The wallet-auth migration retains its known version alias between repository history and Supabase migration history. That alias is metadata only and does not create a second canonical migration.

## Canonical security model

The isolated restore verifies the repository target keeps:

- RLS enabled for application tables;
- browser roles without direct application-table access;
- service-role access required by server APIs;
- browser roles without unrestricted RPC execution;
- the current Planner revision/CAS and share-cascade constraints.

## Planner concurrency contract

The canonical schema keeps:

- `planner_plans.revision integer not null default 1`;
- `planner_shares.source_plan_id -> planner_plans.id ON DELETE CASCADE`;
- one share per wallet/source plan;
- stale revision writes/deletes affecting zero rows, which the API maps to HTTP 409.

A green schema-drift workflow means the **repository target state** is internally replayable and its migration fingerprints are intact. It is not proof that any live environment currently matches that target.
