# API-03 — cache and privacy response contract

Scope: issue #1034. This audit intentionally makes **no runtime cache-policy change** because the current endpoint behavior already separates public revalidation from private/revocable data safely.

## Endpoint matrix

| Surface | Browser cache contract | CDN contract | Reason |
| --- | --- | --- | --- |
| Public `/api/data` snapshot reads | `public, max-age=0, must-revalidate` + ETag | explicit `no-store, max-age=0` | Reuse only through browser conditional requests; snapshot generation + URL define identity. |
| `/api/identity` | `public, max-age=0, must-revalidate` + ETag | explicit `no-store, max-age=0` | Identity may revalidate locally, but must not be retained independently at the CDN. |
| Private/wallet-dependent `/api/data` | `private, no-store, no-cache, must-revalidate, max-age=0` | explicit `no-store, max-age=0` | A guest response must never be reused after a wallet/session transition. |
| Wallet access/preferences/opt-in/session | `no-store` or stricter private no-store | no public cache contract | Responses depend on session state and must be recomputed. |
| Planner/Evaluation share JSON | `no-store` | no public cache contract | Unlisted links are revocable/expiring; a stale copy would outlive revoke. |
| Evaluation preview HTML/image | `no-store, max-age=0` | no public cache contract | Social/share previews resolve live share state and must disappear after revoke/expiry. |
| Operational health | `private, no-store, no-cache, must-revalidate, max-age=0` | no public cache contract | Operational state is dynamic and not a reusable public artifact. |
| Releases | `no-store, max-age=0` | no public cache contract | Release metadata must reflect the deployed runtime. |

## Regression gates

`tests/test_api_cache_privacy.mjs` verifies:

- ETag matching and 304 behavior for public revalidation.
- Public responses remain browser-revalidation-only while both generic CDN cache headers stay `no-store`.
- Private responses do not inherit an ETag or public cache directive.
- `/api/wallet-access` stays `no-store` for both guest and signed-wallet states.
- Revocable Planner/Evaluation shares and Evaluation preview HTML/images remain no-store.
- The existing SEC-06 fixture that proves read → revoke → immediate 404 remains wired into the aggregate API gate.
- Operational health remains explicitly private/no-store.

`validate-security-boundaries.mjs` owns the static endpoint/header matrix so a future route cannot silently loosen one of these policies.

## Deferred release observation

No Vercel deployment is part of API-03. Effective production/CDN headers remain a final-release check under the single-deploy policy for #1034. The runtime policy should only change if that live observation demonstrates a mismatch; local or prebuilt assumptions alone are insufficient.
