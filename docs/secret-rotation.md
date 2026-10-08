# Secret ownership, environment scoping and rotation

This runbook records names, owners and scopes only. Never paste secret values into GitHub issues, logs, workflow summaries or documentation. The repository cannot and should not read GitHub secret values through API tooling.

## Current ownership model

| Surface | Owner / consumer | Names | Scope |
| --- | --- | --- | --- |
| GitHub Actions production data | Full database refresh | MFL_API_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VERCEL_ORG_ID, VERCEL_PROJECT_ID, VERCEL_TOKEN | Production operations only |
| GitHub Actions progression email | Full refresh + Gmail test | SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, EMAIL_FROM, EMAIL_REPLY_TO; optional test fallback PROGRESSION_EMAIL_TEST_RECIPIENT | Production sender / explicit test |
| Vercel runtime | Server API | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WALLET_CHALLENGE_SECRET; optional explicit WALLET_CHALLENGE_ORIGIN | Configure independently for Preview and Production |
| Vercel runtime public wallet config | Wallet challenge response / FCL | WALLETCONNECT_PROJECT_ID | Public identifier, not a credential; sharing across Preview/Production must be intentional and origin registration must cover both |
| Supabase Edge Functions | Database + Marketplace dispatch functions | GITHUB_ACTIONS_DISPATCH_TOKEN, SCHEDULER_SHARED_SECRET, transitional SCHEDULER_SHARED_SECRET_NEXT | Production scheduler |
| Supabase Vault | Cron SQL | mfl_scheduler_project_url, mfl_scheduler_shared_secret | Production scheduler |

GitHub Actions deployment workflows explicitly pull Vercel production environment state. They do not own Preview runtime secrets. Preview runtime separation is therefore a Vercel configuration responsibility, not a GitHub repository-secret convention.

## Required Preview / Production isolation

Preview must not reuse the Production Supabase service-role key or the Production wallet challenge secret. Use a Preview-scoped Supabase project/credential set when private persistence is enabled. Production keeps its production-only values.

WALLET_CHALLENGE_SECRET is used only to sign and verify five-minute login challenges. Durable seven-day wallet sessions are random tokens stored by hash in Supabase and are not signed with this secret. Rotating the challenge secret can invalidate only in-flight challenges created before the switch; existing sessions remain independently resolvable.

For a production custom domain that differs from Vercel's deployment URL, keep WALLET_CHALLENGE_ORIGIN pinned to the exact public HTTPS origin. Preview can normally rely on its Vercel deployment URL unless a stable custom Preview origin is intentionally configured.

## Presence-only checks

The manual workflow Secret scope presence audit maps the GitHub Actions variables into the job and calls scripts/operations/check-secret-presence.mjs. It reports only:
- variable name;
- required/optional classification;
- present or missing.

It never prints values, hashes, lengths or prefixes. The workflow has only contents: read permission.

External surfaces must be checked in their provider UI/CLI by listing variable names and scopes only. Do not download or export environment files for this audit.

## Zero-downtime rotation order

### 1. Preflight

1. Confirm this source inventory still matches the active workflows.
2. Run the GitHub presence-only audit for all-github.
3. Confirm Preview and Production Vercel variable names/scopes only.
4. Confirm Supabase Edge Function and Vault variable names only.
5. Do not revoke any old credential yet.

### 2. Scheduler shared secret

Both scheduler Edge Functions accept the primary SCHEDULER_SHARED_SECRET and the temporary SCHEDULER_SHARED_SECRET_NEXT.

1. Generate a new random scheduler secret offline.
2. Add it as SCHEDULER_SHARED_SECRET_NEXT while leaving the old primary active.
3. Change Vault mfl_scheduler_shared_secret to the new value.
4. Verify one normal database/Marketplace scheduler occurrence or recovery probe reaches the Edge Function successfully.
5. Promote the new value to SCHEDULER_SHARED_SECRET.
6. Remove SCHEDULER_SHARED_SECRET_NEXT only after the new primary is confirmed.
7. Never include either value in logs or issue comments.

This overlap lets old and new Cron callers authenticate during the transition.

### 3. GitHub dispatch token

1. Create the replacement fine-grained token while the old token remains valid.
2. Keep repository scope limited to FraGioco9/mfl-front-office and Actions read/write only.
3. Replace GITHUB_ACTIONS_DISPATCH_TOKEN in Supabase Edge Function secrets.
4. Confirm a dispatch/recovery lookup succeeds.
5. Revoke the old token only after the replacement is proven.

No dual-token application code is required because the old token remains valid until after the Edge Function has switched.

### 4. Vercel Preview runtime

Rotate Preview first:

1. Replace Preview Supabase credentials with Preview-only values.
2. Replace Preview WALLET_CHALLENGE_SECRET.
3. Confirm the intended Preview wallet origin configuration.
4. Keep WALLETCONNECT_PROJECT_ID shared only if that is an explicit public-ID decision and both origins are registered.
5. Redeploy Preview and verify wallet challenge issuance, Supabase-backed private operations and logout without exposing values.

A challenge created in the five minutes before a wallet-secret switch may need to be reissued; existing durable sessions are not keyed by WALLET_CHALLENGE_SECRET.

### 5. Vercel Production runtime

After Preview proves the new configuration:

1. Create or activate replacement provider credentials before revoking old credentials whenever the provider supports overlap.
2. Update Production-scoped Vercel variables.
3. Deploy only through the authorized production release path.
4. Verify runtime identity, operational health, wallet challenge/login, persistence and same-origin writes.
5. Revoke superseded credentials only after verification.

This runbook does not authorize an intermediate production deployment for issue #1034.

### 6. GitHub production secrets

Rotate one credential family at a time:
- MFL API;
- Supabase service role;
- Vercel token/project binding;
- SMTP.

Run the presence-only workflow after each configuration change. Presence is necessary but not proof that a credential is valid; functional verification remains a separate release/recovery gate.

## Failure / rollback rules

- Missing required GitHub variable: stop before dispatch/deploy.
- Scheduler new shared secret fails: restore Vault to the old primary while both Edge values remain accepted.
- New GitHub dispatch token fails: restore the old still-valid token, then investigate permissions.
- Preview runtime fails: revert Preview variables; do not touch Production.
- Production runtime fails: use the OPS-04 rollback runbook; do not mix historical code with an unrelated database snapshot.

## Deliberate non-actions in This runbook

- no secret values are read or changed by this PR;
- no GitHub, Vercel or Supabase environment is created or mutated;
- no production or Preview deployment is triggered;
- no database refresh is triggered;
- no existing credential is revoked.
