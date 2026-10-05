# Production rollback runbook

Issue: #1034 — OPS-04

This runbook restores **application code and the bundled SQLite database as one
Vercel deployment artifact**. It is intentionally separate from the normal
database-refresh and site-update workflows: a rollback must not rebuild current
source with an older database, or current data with older source.

Do not use this procedure for routine releases. Use it only after a production
incident has identified a previously healthy Vercel deployment.

## Safety contract

- **Do not run a Full database refresh during rollback.**
- **Do not run Vercel site update during rollback.**
- Never copy a SQLite file manually into the current source and deploy it as a
  substitute for a known-good historical deployment.
- The rollback target must be an existing Vercel deployment whose
  `/api/identity` and `/api/data?mode=summary` were inspected before the
  production alias is changed.
- Prefer a target whose identity can be matched to either:
  - `production-deployment-identity-<run-id>` from a successful **Vercel site
    update** run; or
  - `full-database-refresh-checkpoints-<run-id>-<attempt>` from a successful
    **Full database refresh** checkpoint publication.
- Never paste `VERCEL_TOKEN`, Supabase keys, wallet data, or private runtime
  objects into an issue, workflow summary, or rollback record.

The production SQLite file is packaged inside the Vercel deployment. Vercel
rollback therefore re-points production to the already-built code+database
artifact instead of rebuilding either half.

## 1. Capture the failing production identity

Before changing anything, save the public identity and database summary:

```powershell
curl.exe -fsS "https://mfl-front-office.vercel.app/api/identity" -o current-identity.json
curl.exe -fsS "https://mfl-front-office.vercel.app/api/data?mode=summary" -o current-data-summary.json
```

Record the incident time and the current Vercel deployment URL from the Vercel
dashboard or `vercel ls`. These files contain public deployment/database
identity only; do not add secrets.

If production is completely unreachable, record that fact and continue with the
last known production identity from GitHub artifacts.

## 2. Select one known-good deployment

List recent deployments and inspect the candidate. This is read-only.

```powershell
vercel ls
vercel inspect <candidate-deployment-url-or-id>
```

Probe the candidate's immutable deployment URL directly, **not** the production
alias:

```powershell
curl.exe -fsS "https://<candidate-deployment-host>/api/identity" -o candidate-identity.json
curl.exe -fsS "https://<candidate-deployment-host>/api/data?mode=summary" -o candidate-data-summary.json
```

Reject the candidate if either endpoint fails, if its SQLite summary is invalid,
or if its identity is not the intended prior release/checkpoint.

### GitHub identity cross-check

For a site-update deployment, download the matching
`production-deployment-identity-<run-id>` artifact and compare its
`siteCommit`, `version`, and `database.generatedAt` with
`candidate-identity.json`.

For a database-refresh deployment, download the matching
`full-database-refresh-checkpoints-<run-id>-<attempt>` artifact and select the
JSON file for the checkpoint that was published. Its
`deploymentIdentity.siteCommit`, `deploymentIdentity.version`, and
`deploymentIdentity.databaseGeneratedAt` must match the candidate.

A mismatch means **stop**. Do not infer a pairing from timestamps alone.

## 3. Dry run — no production mutation

The dry run is complete only when all of the following are true:

- candidate deployment status is READY;
- candidate `/api/identity` is readable;
- candidate `/api/data?mode=summary` is readable;
- the candidate site commit/version/database generation match the selected
  GitHub identity artifact;
- representative candidate routes `/`, `/database`, `/evaluation`,
  `/planner`, and one Player route return the application shell;
- the rollback target is older/different from the currently failing deployment.

Do **not** call `vercel rollback` during the dry run.

Create an incident note containing only:

- failing deployment URL and public identity, when available;
- candidate deployment URL;
- candidate site commit;
- candidate app version;
- candidate database `generatedAt`;
- matching GitHub run/artifact identifier.

## 4. Execute the atomic rollback

Only after the dry run has identified exactly one target:

```powershell
vercel rollback <candidate-deployment-url-or-id>
```

In CI or another non-interactive authenticated shell, supply the normal Vercel
token through the environment/secret store rather than putting it in command
history:

```powershell
vercel rollback <candidate-deployment-url-or-id> --token "$env:VERCEL_TOKEN"
```

Do not run `vercel build`, `vercel deploy --prod`, or a database refresh as
part of this rollback. Rollback should re-point the production alias to the
already-verified historical artifact.

## 5. Verify production after rollback

Read production identity again:

```powershell
curl.exe -fsS "https://mfl-front-office.vercel.app/api/identity" -o rolled-back-identity.json
curl.exe -fsS "https://mfl-front-office.vercel.app/api/data?mode=summary" -o rolled-back-data-summary.json
```

The production values must match the candidate captured in step 2:

- runtime commit when that historical release exposes commit identity;
- release version;
- SQLite `generatedAt`;
- player/wallet counts from the database summary.

Then verify representative routes and operational health:

```powershell
curl.exe -fsS -o NUL "https://mfl-front-office.vercel.app/"
curl.exe -fsS -o NUL "https://mfl-front-office.vercel.app/database"
curl.exe -fsS -o NUL "https://mfl-front-office.vercel.app/evaluation"
curl.exe -fsS -o NUL "https://mfl-front-office.vercel.app/planner"
curl.exe -fsS "https://mfl-front-office.vercel.app/api/operational-health"
```

If production does not match the selected candidate, treat the rollback as
failed and do not start a refresh to mask the mismatch.

## 6. Recovery and forward fix

A rollback is a containment action, not the final repair.

1. Keep the rolled-back deployment serving production while the defect is fixed.
2. Fix the issue on a normal branch/PR.
3. Re-enter the standard release gate from a current, verified `main`.
4. Use the protected **Vercel site update** workflow for the next forward
   release; do not manually rebuild a hybrid code/database artifact.
5. If a database refresh is required afterwards, let the normal staged refresh
   publish coherent checkpoints against the then-current production site source.

## Rollback record template

```text
Incident:
Rollback time (UTC):
Failing deployment:
Failing identity:
Candidate deployment:
Candidate GitHub run/artifact:
Candidate site commit:
Candidate version:
Candidate database generatedAt:
Dry run: PASS / NOT EXECUTED
Rollback command executed by:
Post-rollback identity match: PASS / FAIL
Representative routes: PASS / FAIL
Operational health:
Forward-fix PR:
```

## Existing repository safeguards reused by this runbook

- `scripts/workflows/record-production-identity.sh` records expected
  commit/version/database identity before a protected deployment.
- `scripts/workflows/verify-live-production-deployment.sh` verifies live
  identity, database summary and representative routes after normal releases.
- **Vercel site update** uploads
  `production-deployment-identity-<run-id>` for 90 days.
- **Full database refresh** uploads
  `full-database-refresh-checkpoints-<run-id>-<attempt>` telemetry for 90 days.
- The staged database publisher verifies the historical published site source
  SHA before packaging each checkpoint.

This runbook does not alter those owners and does not authorize a deployment.
