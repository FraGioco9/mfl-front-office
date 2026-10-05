# OPS-07 — GitHub Actions artifact capacity policy

OPS-07 is intentionally **report-only** in its first phase. The monthly workflow inventories all non-expired GitHub Actions artifacts, reports storage and inferred retention, and identifies candidates for review. It does not delete artifacts or alter retention.

## Ownership classes

| Artifact class | Role | Current policy |
| --- | --- | --- |
| `mfl_database` | Canonical cross-workflow database | Preserve. Deploy, Marketplace and email workflows resolve the latest valid non-expired copy. |
| `full-database-refresh-occurrence-*` | Scheduler deduplication state | Preserve 90 days. |
| `production-deployment-identity-*` | Production rollback identity | Preserve 90 days. |
| `performance-baseline-*` | Performance evidence | Preserve 90 days until a separate benchmark-history policy exists. |
| `mfl_marketplace_state` | Published ephemeral state | Existing 1 day. |
| `progression-email-preview` | Manual preview | Existing 7 days. |
| `full-database-refresh-baseline-*` | Same-run recovery | Review candidate: helper resolves only the same `GITHUB_RUN_ID`; target 14 days is advisory only. |
| `full-database-refresh-resume-*` | Same-run recovery | Review candidate: state is accepted only for the same `GITHUB_RUN_ID`; target 14 days is advisory only. |
| `mfl_database-recovery-*` | Failure-only manual recovery | Review candidate: advisory 30 days. |
| `full-database-refresh-checkpoints-*` | Diagnostic checkpoint metadata | Review candidate: advisory 30 days. |
| `full-database-refresh-trigger-*` | Scheduler timing telemetry | Review candidate: advisory 30 days. |
| `actions-artifact-capacity-*` | Monthly storage report | 30 days. |

## Safety rules

1. The report workflow has only `contents: read` and `actions: read`.
2. No delete endpoint is called.
3. Unknown artifact names are classified as `review` and never receive an automatic target.
4. Canonical database, scheduler occurrence and deployment identity artifacts are excluded from automatic trimming.
5. A future retention reduction must be a separate PR with evidence that restore, rerun and rollback paths still work.
6. Cost is reported as storage volume and candidate GiB-days, not currency, because billing depends on the repository/account plan.

## Monthly output

The workflow writes a Job Summary and uploads `actions-artifact-capacity-<run_id>` for 30 days. The JSON records:
- non-expired artifact count and total bytes;
- size by policy class;
- inferred retention from `created_at` / `expires_at`;
- ten largest artifacts;
- advisory candidates and potential GiB-days above target.

This first phase deliberately gathers evidence before changing any production/recovery retention.
