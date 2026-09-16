# Operational freshness and refresh health

Part of #969.

This contract adds production visibility without changing the site's normal data behavior or scheduler ownership.

## Read-only health endpoint

`GET /api/operational-health` combines four signals:

- packaged SQLite `runtime_metadata.generated_at`;
- Marketplace runtime state's `generated_at`;
- latest scheduled database-refresh health marker;
- latest scheduled Marketplace-refresh health marker.

The endpoint is uncached and returns only operational timestamps/statuses, occurrence keys, run IDs and failure counts. It does not expose Supabase credentials, wallet data or private application rows.

Local development without Supabase credentials still returns database freshness; Supabase-backed fields are reported as `unknown`.

## Freshness thresholds

The operational thresholds are intentionally distinct from product fail-closed behavior.

- Database freshness warning: **13 hours**. The production schedule's longest normal gap is from 23:03 to 10:20 Europe/Rome (11h17m), so 13 hours allows normal scheduling/recovery delay while still detecting a missed production cycle.
- Marketplace freshness warning: **2 hours**. Incremental snapshots are scheduled every 15 minutes, but the daily 04:00 reconcile has a 90-minute workflow timeout. Two hours detects sustained staleness without declaring the legitimate full reconcile stale while it is still running.
- Repeated refresh failure: **2 consecutive scheduled failures**.

The Marketplace site's existing 24-hour fail-closed listing cutoff is unchanged. Operational health can therefore report stale/degraded earlier without changing which listing prices the user sees.

## Scheduled health markers

Only Supabase-Cron production dispatches update health markers:

- `mfl-runtime/health/database-refresh.json`
- `mfl-runtime/health/marketplace-refresh.json`

Each marker stores:
- last outcome;
- last attempt;
- last successful attempt;
- consecutive failure count;
- trigger source;
- occurrence key;
- GitHub run ID and attempt.

A successful scheduled run resets the failure streak to zero. A failed or cancelled scheduled run increments it. Manual runs and Marketplace push runs do not rewrite production scheduler health.

The marker writer runs with `always()` after the normal production work and is `continue-on-error`: monitoring failure must not turn a successfully published dataset into a failed refresh. If marker publication itself stops working, marker age becomes stale and the health endpoint exposes that gap.

## Status semantics

- `healthy`: data is within its freshness window and the latest scheduled marker has no failures.
- `warning`: one scheduled refresh has failed and recovery is expected.
- `degraded`: data is stale, the marker is stale, or at least two consecutive scheduled refreshes failed.
- `unknown`: a required monitoring signal is unavailable.

This is visibility only. Existing Supabase Cron primary/recovery scheduling, checkpoint/resume publication, Marketplace fail-closed semantics and deployment identity remain the canonical behavior owners.
