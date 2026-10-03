# PERF-04B — Vercel cache-route ownership and cross-release CSS safety

Scope: [issue #1034](https://github.com/FraGioco9/mfl-front-office/issues/1034), following [PERF-04A](performance-1034-perf04a.md). This is a **measurement and safety investigation**, not an optimization shipped to the application. No production Vercel deployment, database refresh, or change to runtime cache policy is authorized.

## Read-only observations, 2026-10-03

Responses were inspected from `https://mfl-front-office.vercel.app` using the connected Vercel read-only fetch. The current production site was deployed using commit `d6c0f1c9` (v1.128.4), not the yet-unreleased issue #1034 code. The **published commit's** `next.config.mjs` contains the same intended CSS revalidation, shell/release no-store and query-versioned JS immutable rules summarized below, whereas the published commit's `vercel.json` contains security headers but **no Cache-Control overrides**.

| Resource | Intended in published Next config | Observed Vercel HTTP `Cache-Control` | Other actual headers |
| --- | --- | --- | --- |
| `/styles-runtime.css` | `public, max-age=0, must-revalidate` | `public, max-age=0, must-revalidate` | `x-vercel-cache: HIT`, `content-encoding: br`, weak ETag |
| `/` | `no-store, max-age=0` | `public, max-age=0, must-revalidate` | `x-vercel-cache: MISS` |
| `/index.html`, `/database/attributes` | Shell should revalidate safely / not retain user-specific state | `public, max-age=0, must-revalidate` | `x-vercel-cache: HIT` on sampled edge |
| `/release.json` | `no-store, max-age=0` | `public, max-age=0, must-revalidate` | `x-vercel-cache: MISS` |
| `/modules/app-core-runtime.js` (plain or `?mfl_core=perf04b-untrusted`) | Non-versioned `no-store`, version query one-year `immutable` | Both `public, max-age=0, must-revalidate` | `x-vercel-cache: HIT`, Brotli |
| `/api/operational-health` | Private operational status | `private, no-store, no-cache, must-revalidate, max-age=0` | `x-vercel-cache: MISS` |
| `/api/identity` | Dynamic identity, CDN `no-store` | `public, max-age=0, must-revalidate` plus `cdn-cache-control: no-store, max-age=0` | `x-vercel-cache: MISS` |

**Interpretation:** At least for the tested static paths, the effective production headers are **not identical to the configured Next rules**. These are final HTTP observations, not a dump of the Build Output API artifact, and they must not be used to infer edge precedence or whether a browser sent a conditional validator. The Vercel docs state that static files are CDN cached automatically and that function responses can override configured cache headers. Do not assume that changing `next.config.mjs` automatically changes final static response headers or that a version string query provides historical content identity.

The live CSS response was served Brotli-compressed; its returned text length is decoded body size, **not** transferred bytes. The 370,079-byte CSS with an ETag and a conditional 200 was measured in PERF-04A's **different local Next build**; do not compare these byte sizes as an A/B performance result.

## Cross-release contract

The canonical production CSS link is still `/styles-runtime.css`. Both the source-owned manifest `legacy-public-assets.cjs` and `prepare-next-runtime.mjs` project **one mutable stylesheet** into `public/`. Neither the current Next assets nor Vercel release process guarantees that `/assets/styles-runtime.<sha256>.css` remains retrievable from the *current production domain* after a new release.

New opt-in `validation/perf04b-cross-release-cache.mjs` uses a real local HTTP server, the canonical generated CSS bytes, and a modified **synthetic release B** stylesheet to verify:

- Stable CSS with `max-age=0, must-revalidate` revalidates with `If-None-Match` and returns 304 on an unchanged synthetic revision, then HTTP 200 with the new bytes on release swap.
- A query-only version marker returns **new release bytes under an old-release query URL** when the file path is overwritten. Long-lived `immutable` on this URL is incorrect, even if the query resembles a SHA.
- Truly content-addressed **pathname** URLs provide same-release browser cache hits with no HTTP round trip and can serve both release A and B **only if both historical files are retained**. The fixture explicitly retains both in memory. Unknown hashed paths return 404, not latest content.
- The in-memory response-byte counter and cache-hit measurements are an **offline contract**, not Chrome/Safari RUM or a live CDN benchmark.

`scripts/workflows/inspect-prebuilt-cache.mjs` can inspect a genuine `.vercel/output/config.json` **read-only** and reports all matching, explicit cache-header candidates on HTML, CSS, JS and API paths, flagging unsafe unversioned `immutable` declarations. `validate-perf04b-prebuilt-model.mjs` exercises its route logic with a **synthetic Build Output API v3 configuration** and fail-closed unsafe mutations. The synthetic model alone does **not** validate actual prebuilt output or its effective network headers.

### Actual prebuilt artifact gate (build-only, temporary workflow)

A temporary GitHub Actions workflow `perf04b-prebuilt-build-only.yml` uses the repository's established Vercel project connection to run `vercel pull` and **`vercel build --prod` only**, with a synthetic SQLite fixture and no deployment command. It validates actual generated `.vercel/output/config.json` against the existing CSP checker and the new read-only route inspector, and uploads **only a route/header summary** (not environment files or functions). The workflow is removed **before merging the PR**. Failed or unavailable authorization/build artifacts must be noted as incomplete evidence, never replaced with assumptions.

## Decision gate

A CSS immutable optimization requires all conditions, not merely a smaller local transfer measurement:

1. A real hash-addressed CSS pathname, generated deterministically from emitted bytes.
2. Both old/new hashed assets retrievable from the **current production origin after an actual release transition**, or a proven redirect/retention mechanism; an old query marker is not enough.
3. Effective browser/CDN `Cache-Control`, `ETag`, CSP and routing rules confirmed on **real prebuilt output and live HTTP**. Do not infer them solely from local Next.
4. Paired same-runner browser experiments cold, refreshed, cached return and slow-mobile first use with encoded/transferred bytes. No new initial requests, missing CSS, flash of unstyled content, wrong deep-link style or wallet/private cache regression.
5. Final iPhone/Safari and Vercel observations deferred until the single planned deployment for issue #1034.

**Current decision:** preserve `max-age=0, must-revalidate` on the stable CSS URL; do not extend JavaScript `immutable` rules to unretained query-only CSS. Actual build-only capture and CI results should be appended here. If cross-release retention and observable speedup cannot be demonstrated, close the optimization as **NO CHANGE**; do not introduce potentially stale or mixed assets.

## Validation

```bash
node validate-perf04b-prebuilt-model.mjs
node validation/perf04b-cross-release-cache.mjs
npm run validate
# Only if .vercel/output/config.json exists locally, no deployment:
node scripts/workflows/inspect-prebuilt-cache.mjs .vercel/output/config.json
```
