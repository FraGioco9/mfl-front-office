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

When an Issue is implemented by a pull request, link it with `Closes #<issue>` so GitHub closes the Issue automatically after merge.

## Milestones

Use Milestones as release buckets that follow the repository's Semantic Versioning:

- patch milestone, for example `v1.124.2`, for fixes that do not add meaningful functionality;
- minor milestone, for example `v1.125.0`, for features, larger UX changes, or meaningful refactors.

Keep only the next relevant patch/minor milestones open. Assign both Issues and direct pull requests when they belong to a planned release, then close the milestone when that release is complete.

## Dependabot

Dependabot checks npm dependencies under `/site` and GitHub Actions weekly on Monday morning (Europe/Rome). Minor and patch updates are grouped to reduce pull-request noise; major updates remain separate so breaking changes can be reviewed independently.

Dependabot Alerts and Dependabot Security Updates should also be enabled in **Settings > Security > Code security and analysis** so vulnerable dependencies can trigger security-focused updates outside the normal weekly version-update cadence.
