# DB-05 — Planner saved-list workload and capacity

Issue: #1034  
Audit date: 2026-10-06  
Production access: read-only only

## Workload evidence

Production currently contains **1 saved Planner plan for 1 wallet**; no wallet is
near the 50-plan cap.

Observed `pg_stat_statements` samples are already fast:

- historical list query without revision: **35 calls**, **0.342 ms mean**;
- current list query with revision: **4 calls**, **0.539 ms mean**;
- current single-plan lookup with revision: **6 calls**, **2.057 ms mean**;
- saved-plan ID count/precheck: **4 calls**, **0.782 ms mean**.

The existing `planner_plans_wallet_updated_idx(wallet_address, updated_at desc)`
has **43 observed scans** and the primary key has **41**. Read-only EXPLAIN shows:

- wallet count/precheck uses `planner_plans_wallet_updated_idx`;
- wallet list uses that same index as its wallet predicate input;
- ID lookup uses `planner_plans_pkey`;
- revision CAS update/delete use the primary key, then filter wallet/revision.

**No new index is justified by DB-05.** The current table is tiny, the workload is
fast, and both existing indexes have demonstrated use.

## Correctness finding

The application-level limit check is intentionally retained because it gives the
normal 50-plan case a fast, clear HTTP 429. By itself, however, it is not an
atomic invariant:

1. wallet has **49** plans;
2. request A counts 49;
3. request B counts 49;
4. A inserts plan 50;
5. B can insert plan **51**.

This is a real check-then-write race even though the live dataset has not reached
the boundary.

## Database guard

`20261006183001_planner_plan_capacity_guard.sql` adds a
`BEFORE INSERT` trigger backed by
`public.enforce_planner_plan_wallet_limit()`.

The trigger obtains a transaction-scoped advisory lock derived from the wallet,
then recounts that wallet before allowing the insert. Different wallets do not
normally block each other. A hash collision is safe and causes only unnecessary
serialization.

At 50 plans it raises the private sentinel
`planner_plan_limit_exceeded`. The API maps that sentinel to the same HTTP 429
message as the existing pre-check, so a concurrent loser is not surfaced as a
500.

The function is `SECURITY INVOKER`, uses an empty `search_path`, and revokes
execution from PUBLIC/anon/authenticated while preserving service-role execution.

## Transactional CI

The dedicated PostgreSQL 17 workflow restores the canonical schema and exercises:

- **49 + two simultaneous inserts**: exactly one succeeds and final count is 50;
- attempted plan 51: rejected;
- list count stays at 50;
- stale rename: affects zero rows;
- stale delete: affects zero rows;
- current-revision delete: succeeds;
- linked Planner share: removed by `ON DELETE CASCADE`.

The workflow uses two independent `psql` connections for the concurrent insert
case. It does not connect to Supabase production.

## Release status

The migration is staged in Git only. Merging DB-05 does **not** apply it to the
Supabase project. Application deployment and database migration remain part of
the explicitly authorized coordinated release gate.
