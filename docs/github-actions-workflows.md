# GitHub Actions workflow inventory

This is the canonical human-readable inventory of the workflows currently tracked under `.github/workflows/`.
The YAML files remain the source of truth for exact path filters, permissions, inputs and implementation.

There are **13 workflows** on `main` after the October 2026 repository cleanup.

| Workflow file | Display name | Triggers | Responsibility |
| --- | --- | --- | --- |
| `cleanup-unused-branches.yml` | Cleanup unused branches | Closed PR via `pull_request_target`; selected `main` pushes; manual dispatch | Deletes only remote branches that pass the protected cleanup checks. |
| `db-03-schema-drift.yml` | DB-03 schema drift | Path-filtered pull request; manual dispatch | Isolated schema-drift inventory/restore regression for Supabase-facing changes. |
| `db-05-planner-capacity.yml` | DB-05 Planner capacity | Path-filtered pull request; manual dispatch | Isolated Planner capacity/schema regression. |
| `full-database-refresh.yml` | Full database refresh | Manual dispatch | Production database pipeline. The production clock lives in Supabase Cron, which reaches this workflow through `workflow_dispatch`; GitHub does not schedule it directly. |
| `mfl-marketplace-snapshot.yml` | MFL marketplace snapshot | Path-filtered pull request; selected `main` pushes; manual dispatch | Marketplace snapshot validation/publication. Production cadence is owned by Supabase Cron and dispatched through `workflow_dispatch`. |
| `operational-health-monitor.yml` | Operational health monitor | GitHub schedule at minute 07/37; manual dispatch | Read-only production-health monitoring and one deduplicated incident issue. |
| `progression-email-gmail-test.yml` | Progression email Gmail test | Manual dispatch | Explicit owner-only real Gmail delivery test. |
| `sec-03-auth-rate-limit-postgres.yml` | SEC-03 distributed auth rate limit | Path-filtered pull request | Isolated PostgreSQL regression for the distributed wallet-auth quota. |
| `sec-05-supabase-grants-postgres.yml` | SEC-05 Supabase grants and RLS | Path-filtered pull request; manual dispatch | Isolated PostgreSQL grants/RLS regression. |
| `secret-scope-audit.yml` | Secret scope presence audit | Manual dispatch | Presence-only GitHub Actions secret-scope audit; reports names and present/missing status without secret values. |
| `site-quality.yml` | Site quality | Pull request; `main` push; manual dispatch | Canonical required `quality` check, generated-artifact ownership, build/lint/typecheck, Next rendered-shell/CSP checks, isolated loading/search/feedback fixtures, accessibility, mobile/responsive/table and core browser regressions. |
| `validate-sec-01-trigger-search-path.yml` | SEC-01 trigger search_path regression | Path-filtered pull request | Isolated PostgreSQL regression for pinned trigger `search_path`. |
| `vercel-site-update.yml` | Vercel site update | Manual dispatch from `main` with pinned SHA + explicit production approval | Production Vercel deployment using the latest valid database artifact. Preflight requires the requested SHA to equal current `main`, requires the exact-head `quality` check and no blocking/unsettled checks, records a release fingerprint, binds the deploy job to the `production` environment, and rechecks `main` immediately before publish. |

## Canonical local commands

Run from the repository root with Node.js 22:

```powershell
npm ci --no-audit --no-fund
npm run dev
```

The principal lifecycle commands are:

- `npm run dev` — Next development server on port 4000, after `predev` prepares the compatibility projection.
- `npm run build` — canonical generated assets followed by `next build`.
- `npm run check` — lint, typecheck, build, generated-artifact verification and repository validation.
- `npm run start` — starts an already-built Next production server on port 4000.
- `npm run performance:capture` — opt-in performance harness; it is not part of ordinary quality CI.

Database and operational Python entry points are run from the repository root with `python -m ...`, as documented in [source ownership and operational commands](ownership.md).

## Ownership and update rule

- Workflow YAML owns triggers, permissions, credentials, environment, path filters, working directories and artifact boundaries.
- Extracted shell/Python/Node helpers under `scripts/workflows/` or other documented source owners own implementation details called by YAML.
- **Site quality** remains the only writer of tracked generated application artifacts and the single home for always-on browser, accessibility, loading/search/feedback, mobile and table regressions.
- When a workflow is added, removed, renamed or its trigger model materially changes, update this document and the summary in the root README in the same PR.
- Do not infer production scheduling from a GitHub `schedule:` block: database and Marketplace production clocks are Supabase-owned; only Operational health monitor currently uses GitHub's schedule directly.
