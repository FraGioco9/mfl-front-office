# Production release gate — OPS-03

The protected `Vercel site update` workflow remains a **manual production action**. This workflow does not create an automatic deploy trigger and does not change Vercel, Supabase, GitHub Environment or database state by itself.

## Release request contract

A production dispatch must be started from the `main` branch and must provide:

- `release_sha`: the exact 40-character commit SHA approved for release;
- `release_approval=DEPLOY_PRODUCTION`: the explicit destructive-action confirmation.

The preflight rejects the run before any Vercel command when:

- the workflow was dispatched from a ref other than `main`;
- `release_sha` is malformed;
- `release_sha` is not the current `main` head;
- production approval is absent;
- the latest exact-head `quality` check is missing, pending or not successful;
- another latest check on the same SHA is still unsettled or has a blocking conclusion.

Retries of a check are handled by check name: the newest check-run id for that name is authoritative, so a later successful retry supersedes an older failed attempt.

## Production environment boundary

The deploy job declares GitHub Environment `production`.

Repository-level required reviewers or other environment protection rules remain GitHub settings owned by the maintainer; this PR does not create or mutate those live settings. If protection rules are configured, GitHub applies them before the deploy job can start. The explicit `DEPLOY_PRODUCTION` workflow input remains required independently.

## Source pinning and stale-main protection

After preflight:

1. the repository is checked out at the approved `release_sha`, not an implicit moving branch;
2. production identity is recorded against that same SHA;
3. the prebuilt Vercel bundle embeds and verifies that SHA;
4. immediately before `vercel deploy --prebuilt --prod`, the workflow queries `main` again;
5. if `main` advanced after approval, the run fails and no production publish occurs.

This avoids silently deploying an older approved commit after a newer merge lands.

## Release fingerprint

The preflight creates a SHA-256 fingerprint over:

- approved release SHA;
- exact-head required `quality` check id;
- latest check name/id/status/conclusion set considered by the gate.

The fingerprint and check count are carried into the deploy job and written to `mfl-production-preflight.json`. The existing `production-deployment-identity-<run-id>` artifact now retains both:

- `mfl-production-expected.json` — site/version/database identity;
- `mfl-production-preflight.json` — release-gate fingerprint.

No secret values, wallet identifiers, request payloads or Vercel tokens are included.

## Validation

Repository fixtures cover:

- valid green exact-head release;
- wrong/stale main SHA;
- missing production approval;
- failed required `quality`;
- another red check;
- another in-progress check;
- a successful retry superseding an older failed check.

The deployment ownership validator also requires the workflow to retain:

- main-only dispatch enforcement;
- explicit production approval;
- pinned SHA checkout;
- exact-head preflight helper;
- `production` environment boundary;
- source identity binding;
- stale-main recheck immediately before publish;
- post-deploy production verification;
- rollback identity and preflight evidence artifact.

## Operational rule

Production deployment remains an explicit maintainer action. Merging code or passing CI is not deployment authorization.
