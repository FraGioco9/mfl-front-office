# GitHub Actions workflow inventory

This is the canonical human-readable inventory of the workflows currently tracked under `.github/workflows/`.
The YAML files remain the source of truth for exact path filters, permissions, inputs and implementation.

There are **26 workflows** on `main` as of 6 October 2026.

| Workflow file | Display name | Triggers | Responsibility |
| --- | --- | --- | --- |
| `accessibility-announcements.yml` | Accessibility A11Y-04 | Pull request; manual dispatch | Live-region/toast announcement and duplicate-suppression regression. |
| `accessibility-audit.yml` | Accessibility A11Y-01 | Pull request; manual dispatch | axe-core and keyboard accessibility regression. |
| `accessibility-contrast.yml` | Accessibility A11Y-03 | Pull request; manual dispatch | Theme and phone color-contrast regression. |
| `accessibility-controls.yml` | Accessibility A11Y-02 | Pull request; manual dispatch | Rendered control names/states regression. |
| `accessibility-landmarks.yml` | Accessibility A11Y-06 | Pull request; manual dispatch | Landmark ownership and skip-navigation regression. |
| `accessibility-motion.yml` | Accessibility A11Y-05 | Pull request; manual dispatch | Normal/reduced-motion regression. |
| `actions-artifact-capacity-report.yml` | Actions artifact capacity report | Monthly GitHub schedule on day 1; manual dispatch | Read-only inventory of non-expired Actions artifact storage, policy classes and advisory retention candidates. |
| `cleanup-unused-branches.yml` | Cleanup unused branches | Closed PR via `pull_request_target`; selected `main` pushes; manual dispatch | Deletes only remote branches that pass the protected cleanup checks. |
| `full-database-refresh.yml` | Full database refresh | Manual dispatch | Production database pipeline. The production clock lives in Supabase Cron, which reaches this workflow through `workflow_dispatch`; GitHub does not schedule it directly. |
| `load02-failure-isolation.yml` | LOAD-02 stale-error and retry regression | Path-filtered pull request; manual dispatch | Deterministic stale-error/retry fixtures. |
| `load03-search-isolation.yml` | LOAD-03 isolated search concurrency | Path-filtered pull request; manual dispatch | Search debounce/cancellation/concurrency fixtures. |
| `load04-feedback-isolation.yml` | LOAD-04 isolated feedback contexts | Path-filtered pull request; manual dispatch | Toast, feedback, mutation and focus-context fixtures. |
| `mfl-marketplace-snapshot.yml` | MFL marketplace snapshot | Path-filtered pull request; selected `main` pushes; manual dispatch | Marketplace snapshot validation/publication. Production cadence is owned by Supabase Cron and dispatched through `workflow_dispatch`. |
| `mobile-first-paint-regression.yml` | Mobile first-paint regression | Pull request; manual dispatch | Mobile first-paint, resize, orientation and compact-table browser regressions. |
| `next-rendered-shell.yml` | Next rendered shell | Path-filtered pull request; manual dispatch | Real Next shell, CSP and rendered-route browser checks. |
| `operational-health-monitor.yml` | Operational health monitor | GitHub schedule at minute 07/37; manual dispatch | Read-only production-health monitoring and one deduplicated incident issue. |
| `performance-baseline.yml` | Performance baseline | Manual dispatch | Opt-in browser performance capture against the latest validated database artifact. |
| `progression-email-gmail-test.yml` | Progression email Gmail test | Manual dispatch; retained maintenance-branch push trigger | Explicit real Gmail delivery test owned by the repository owner. |
| `progression-email-preview.yml` | Progression email preview | Manual dispatch | Renders a progression-email preview without deployment or SMTP. |
| `sec-03-auth-rate-limit-postgres.yml` | SEC-03 distributed auth rate limit | Path-filtered pull request | Isolated PostgreSQL regression for the distributed wallet-auth quota. |
| `sec-05-supabase-grants-postgres.yml` | SEC-05 Supabase grants and RLS | Path-filtered pull request; manual dispatch | Isolated PostgreSQL grants/RLS regression. |
| `secret-scope-audit.yml` | Secret scope presence audit | Manual dispatch | Presence-only GitHub Actions secret-scope audit; reports names and present/missing status without secret values. |
| `site-quality.yml` | Site quality | Pull request; `main` push; manual dispatch | Canonical scope detection, generated-artifact ownership, regressions, build/lint/typecheck and the required `quality` check. |
| `table-header-1374-regression.yml` | Table header 1374 regression | Pull request; manual dispatch | Browser regression for first-column/table-header layout at 1374px. |
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
- `npm run performance:baseline` — opt-in performance harness; it is not part of ordinary quality CI.

Database and operational Python entry points are run from the repository root with `python -m ...`, as documented in [source ownership and operational commands](ownership.md).

## Ownership and update rule

- Workflow YAML owns triggers, permissions, credentials, environment, path filters, working directories and artifact boundaries.
- Extracted shell/Python/Node helpers under `scripts/workflows/` or other documented source owners own implementation details called by YAML.
- **Site quality** remains the only writer of tracked generated application artifacts.
- When a workflow is added, removed, renamed or its trigger model materially changes, update this document and the summary in the root README in the same PR.
- Do not infer production scheduling from a GitHub `schedule:` block: database and Marketplace production clocks are Supabase-owned; only Operational health monitor currently uses GitHub's schedule directly.
