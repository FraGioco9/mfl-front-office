# Repository management

## Main branch ruleset

Configure one active branch ruleset targeting the default branch (`main`):

- require changes to enter `main` through a pull request;
- require the `quality` check from the **Site quality** workflow;
- require the branch to be up to date before merging;
- require conversation resolution;
- require linear history;
- block force pushes;
- block branch deletion;
- do not require review approval for the single-maintainer workflow;
- keep repository-admin bypass available for emergencies only.

Do not require signed commits or deployments unless the development workflow changes.

## Issues

Use Issues for work that may outlive one edit or benefits from a durable problem statement. The repository provides forms for bugs, features, and maintenance/refactors. Small fixes that are immediately implemented can still start directly as a pull request.

When one pull request fully implements an Issue, link it with `Closes #<issue>` so GitHub closes the Issue automatically after merge. For a multi-PR roadmap, intermediate PRs must use `Refs #<issue>`; reserve `Closes #<issue>` for the final PR that actually completes the Issue.

## Milestones

Use Milestones as release buckets that follow the repository's Semantic Versioning:

- patch milestone, for example `v1.124.2`, for fixes that do not add meaningful functionality;
- minor milestone, for example `v1.125.0`, for features, larger UX changes, or meaningful refactors.

Keep only the next relevant patch/minor milestones open. Assign both Issues and direct pull requests when they belong to a planned release, then close the milestone when that release is complete.

## Dependabot

Dependabot checks the root npm application package under `/` at 06:00 Europe/Rome every Monday and GitHub Actions under `/` at 06:15. Minor and patch npm updates are grouped; ESLint majors have their own group. GitHub Actions minor/patch updates and major updates are grouped separately. The root paths and grouping rules are defined in `.github/dependabot.yml`; update this document whenever that source changes.

Dependabot Alerts and Dependabot Security Updates should also be enabled in **Settings > Security > Code security and analysis** so vulnerable dependencies can trigger security-focused updates outside the normal weekly version-update cadence.


## Workflow inventory

The human-readable workflow index is [docs/github-actions-workflows.md](../docs/github-actions-workflows.md). The YAML under `.github/workflows/` remains authoritative for exact triggers, permissions and path filters. When workflows are added, removed, renamed or materially retargeted, update that inventory and the README summary in the same pull request.


## Pull-request stack workflow

See [CONTRIBUTING.md](../CONTRIBUTING.md) and [docs/pr-stack-runbook.md](../docs/pr-stack-runbook.md) for the exact-head CI gate, generated-artifact ownership, stack re-alignment, squash-merge approval, rollback, and release/changelog process.
