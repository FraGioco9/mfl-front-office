# SEC-04 — CSP hardening, phase 1: Report-Only and origin inventory

Part of [issue #1034](https://github.com/FraGioco9/mfl-front-office/issues/1034), milestone **v1.129.0**.

## Guardrail: no enforcement change

`next.config.mjs` deliberately preserves the enforced
`Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none'`
for both development and production. No existing script, style, frame, font,
image, popup, wallet or RPC flow becomes blocked by this phase.

**Production builds only** also emit `Content-Security-Policy-Report-Only`.
It is an experimental *candidate policy*: violations are observation, **not
proof that a feature broke**. It intentionally reports legacy/Next inline
scripts and possibly Flow/Dapper resources, while leaving them operational.
Development builds omit the report-only header to avoid Next dev/eval noise.

Browser delivery:
- `report-to mfl-csp` with `Reporting-Endpoints: mfl-csp="/api/csp-report"`
  for the modern Reporting API;
- `report-uri /api/csp-report` for browsers still using the older report format.

Both point only to the application's same-origin endpoint, requiring no
third-party telemetry service or database table.

## Source-grounded origin and resource inventory (initial)

| Resource or runtime | Observed host or mechanism | Current evidence |
| --- | --- | --- |
| Flow/FCL ES module | `https://esm.sh` | `FLOW_WALLET_MODULE_URLS` in `modules/core-sources/shared-foundations.js`; dynamic `import(src)` in `modules/core-sources/wallet.js` |
| Flow discovery/authentication | `https://fcl-discovery.onflow.org` | `FLOW_DISCOVERY_WALLET` / `FLOW_DISCOVERY_AUTHN_ENDPOINT` |
| Flow access node | `https://rest-mainnet.onflow.org` | `configureFlowWallet` |
| MFL external data | `https://api.playmfl.com` | `loadWalletNames` / Dapper helper fetch |
| Google Fonts stylesheet | `https://fonts.googleapis.com` | `index.html` stylesheet |
| Google Fonts assets | `https://fonts.gstatic.com` | `index.html` preconnect/preloaded font URLs |
| First-party scripts, styles and API | `'self'` | Next, `/modules/*`, `/bootstrap.js`, `/api/*`, `/styles-runtime.css` |
| Inline scripts and styles | `<script>` and inline `style=` / `<style>` | Legacy `index.html` and Next-generated scripts |
| Images / avatars / club logos | First-party, runtime remote HTTPS, data/blob | Mixed public player/club rendering; observe actual destinations before narrowing |
| Dapper/WalletConnect popups or embedded providers | Third-party destinations may vary | Must observe a **real opt-in** session; do not guess or enforce a fixed list |
| Next runtime / dynamic imports | First-party scripts + runtime-generated inline initialization | Page shell and `pages/_document.js` |

The phase-1 candidate initially permitted only `'self'` and `https://esm.sh`
as external script sources. Phase 2a additionally hashes the 12 known stable
parser-time legacy inline scripts, still **without `'unsafe-inline'` or
`'unsafe-eval'`**, to identify remaining sources. This will generate expected reports
from the legacy and Next.js shell. A report-only violation is not a security
block. The less-constrained `connect-src 'self' https: wss:` and
`img-src 'self' data: blob: https:` deliberately avoid guessing dynamic
origins until a complete browser inventory exists. Style inline allowances
remain in the candidate initially.

## Phase 2a (01 October 2026): hash-backed legacy inline script allowlist

**Source-grounded finding:** The canonical generated `index.html` currently
contains **12 inline parser-time executable scripts**, preserving initial
route state, table controls, player/Planner first paint and other pre-hydration
behavior. Moving these scripts into separately fetched files would alter parser
timing, performance and content visibility unless explicitly staged.

This phase uses a CSP hash allowlist instead of moving scripts:
- `csp-legacy-script-hashes.mjs` reads the generated `index.html` and
  calculates one SHA-256 digest for each executable inline script's **exact
  UTF-8 body**, avoiding `'unsafe-inline'` or build-unstable hardcoded hashes;
- `next.config.mjs` includes those digests in the existing
  **Report-Only** `script-src` and `script-src-elem` directives alongside
  `'self'` and `https://esm.sh`;
- the inventory is fail-closed at **build time**: any change from the
  currently reviewed script count (12) or duplicate script hash causes the
  build to stop until the inventory is re-reviewed; and
- `validate-csp-legacy-script-hashes.mjs` verifies all digest inputs and
  checks HTML-to-React rendering preserves inline script bytes. The repository
  validation pipeline includes it. The Next rendered-shell workflow additionally
  fetches actual Home, Planner, Player and Evaluation route HTML and verifies that
  all 12 source hashes appear byte-for-byte in those documents.

The generated-HTML source scan also found **0 static inline event
handler attributes** (such as `onclick=`), **0 `javascript:` href/src
values**, and **24 inline `style=` attributes**. These counts are source
inventory measurements, not a substitute for checking runtime-inserted
attributes in a browser.

This intentionally **does not** cover Next.js request-dependent bootstrap
scripts, third-party/runtime dynamically generated inline scripts, inline
event handler attributes or inline style attributes. The existing report-only
candidate may still report these. An enforced `script-src` with only the
legacy hashes would break Next unless those sources receive a separately
verified request nonce (or other approved mechanism). The check is intentionally
limited to deterministic legacy scripts; no nonce is added or assumed.

**Observability update (01 October 2026):** Production now serves
`1504d4f3`, which includes the Report-Only header. The initial deployment
revealed the missing Next Pages API adapter for `/api/csp-report`; see
Phase 2c for the repair and deployment acceptance gate. Reliable CSP
report telemetry requires this fix to be deployed. Dapper popup sources
cannot be inferred without a real browser/wallet test.

**Rollout:** After deploying and verifying phase 1/phase 2a, inventory
remaining `script-src`, `script-src-elem` and `script-src-attr` reports.
Keep the enforced header byte-for-byte unchanged. If rendered HTML differs
from source bytes, fix the source-to-renderer contract, **not** by enabling
`'unsafe-inline'`.

## Phase 2b: opt-in Next Pages Router nonce validation

The Next.js 16 Pages Router can pass a per-request CSP nonce through
`_document.getInitialProps`, `<Head>`, and `<NextScript>`. This is tested
without enforcing any new CSP directives.

- `csp-report-only-policy.mjs` owns the existing static Report-Only policy
  and adds a validated per-request nonce to its two script directives.
  A checked-in `csp-legacy-hash-snapshot.mjs` contains the 12 reviewed
  hash literals so Next's proxy bundle never needs a filesystem read.
  `next.config.mjs` and the validator fail if these differ from the
  exact generated HTML; `node scripts/workflows/refresh-csp-legacy-hashes.mjs`
  regenerates the snapshot after a reviewed parser-time script change.
  `node scripts/workflows/refresh-csp-legacy-hashes.mjs --check`
  verifies that source and snapshot are synchronized.
  The static default configuration, 12 legacy SHA-256 digests and enforced
  CSP remain unchanged.
- `proxy.js` (Next.js 16 Node.js runtime) generates 16 cryptographically
  random bytes per SSR request and forwards them in an overwritten,
  internal-only `x-mfl-csp-nonce` header. It sets the **Report-Only**
  response header for that exact response, and `Cache-Control: private,
  no-store` so a nonce-bearing response cannot be cached and replayed.
- `pages/_document.js` only accepts a correctly shaped nonce when
  `MFL_CSP_NONCE_REPORT_ONLY=1`, and passes it to `Head` and `NextScript`.
  The 12 parser-time legacy scripts keep using build-stable SHA-256 hashes.
- The experiment applies only to dynamically server-rendered catch-all
  pages (for example, `/players/1`, `/database/attributes`, and
  `/watchlist`), not the statically optimized Home, Planner, or saved
  Planner pages, nor API requests, Next assets, file URLs or the
  Evaluation share preview rewrite. Do not supply a request nonce to a
  statically prerendered/cached HTML document: it would be reused.
- **Disabled by default** in production and development. Enable only on
  a dedicated test deployment by explicitly setting
  `MFL_CSP_NONCE_REPORT_ONLY=1` and deploying that configuration.
  Existing deployments lacking that setting preserve their previous headers.
- CI exercises both cases: ordinary Site Quality runs with the flag off;
  the Next rendered-shell (dev) and Site Quality production runtime smoke
  tests enable it and verify different nonces across requests, untrusted
  header overwrite, `NextScript` HTML serialization, unchanged static
  routes, legacy first-paint hash parity, non-cached responses and unchanged
  enforced CSP.

**Important deployment and enforcement gates:**

1. The production site last observed at commit `00c69330` predates CSP
   reporting. Deploy current main to a preview or production test
   environment; check headers and sanitized CSP reports.
2. Run actual FCL/Dapper sign-in, reject/cancel, logout, popup and share
   flows in the browser. The assistant cannot simulate possession of a
   real user wallet. Only after those browser checks should dynamic
   third-party sources be narrowed.
3. The opt-in nonce experiment is **not** a complete nonce rollout.
   Static Home/Planner and error-page delivery would require explicit
   dynamic-rendering and caching design before nonce-based enforcement.
   Never ship an enforced `script-src` on these routes merely because
   the SSR experiment passed.
4. Phase 3 enforcement requires a distinct, explicitly reviewed PR,
   complete browser evidence and an immediate rollback plan. No changes
   in phase 2b weaken or replace the current enforced
   `frame-ancestors 'none'; base-uri 'self'; object-src 'none'` policy.

Rollback phase 2b by removing the opt-in flag, then (if necessary)
reverting `proxy.js`, the `_document` nonce handoff, and shared
policy helper. No database migration or auth-state change is involved.

## Production deployment header repair (01 October 2026)

The protected deploy run
[#36891193610](https://github.com/FraGioco9/mfl-front-office/actions/runs/36891193610)
**successfully built and published** `94304240`, then failed its
live-header gate. Follow-up read-only diagnostics from a GitHub-hosted
runner proved that the deployed **homepage, `/index.html`, deep-link
HTML and `/api/csp-report` all omitted** `Content-Security-Policy`,
`Content-Security-Policy-Report-Only`, `Reporting-Endpoints`
and `X-Frame-Options`. The API endpoint itself returned the expected
405 for a GET, confirming the route adapter was deployed.

In this prebuilt Vercel CLI deployment arrangement, the
`next.config.mjs` `headers()` configuration was **not reaching the
Vercel edge** for static/rewritten routes. The correct fix is to publish
the **same** existing policy as a global `vercel.json` header rule,
`source: "/(.*)"`, which applies to pages, static files, and API
responses. No script restrictions are added to the enforced CSP.
The 12 reviewed legacy hashes, report-uri and report-to remain in
the **Report-Only** header.

The checked-in `vercel.json` is derived using
`node scripts/workflows/sync-vercel-security-headers.mjs --write`
and verified without modification using
`node scripts/workflows/sync-vercel-security-headers.mjs`.
The standard repository validator and the protected Vercel build
reject drift between those edge headers and the canonical
`next.config.mjs` + `csp-report-only-policy.mjs` values.

**Rollout:** Once the fix is squash-merged and all CI green,
rerun the protected [Vercel site update](https://github.com/FraGioco9/mfl-front-office/actions/workflows/vercel-site-update.yml)
on the latest `main`. Its post-deploy verifier rejects absent
enforced/Report-Only CSP, missing frame protection, missing report
endpoint, mismatched commit/database, and broken canonical HTML.
Monitor the first-party sanitized report logs and manually test real
Dapper auth afterwards. **Do not** turn on
`MFL_CSP_NONCE_REPORT_ONLY` before evaluating interaction between
a request-scoped proxy CSP and Vercel's global edge header.

## Phase 2d: remove legacy global-script eval bridges

Once the protected deployment [#36894656576](https://github.com/FraGioco9/mfl-front-office/actions/runs/36894656576) successfully published `d6c0f1c9`,
Vercel logs showed **real Report-Only violations** from `players`:
`script-src` with blocked source `eval`, recurring roughly every
10 seconds in the initial 16:50–16:53 UTC sample. The collector
returned HTTP 204; no server errors were observed in that sampled window.

A source review identified **five** direct uses of `window.eval` in
four classic-script runtime bridges:
- `nationality-filter-options-runtime.js`: nationality options and
  filter-draft refresh;
- `selection-startup-reset-runtime.js`: saved table state/selection reset;
- `filter-controls-runtime.js`: numeric steppers, operator and filter
  defaults;
- `shared-table-ui-runtime.js`: mobile table page-size restore.

These are a **plausible cause** of the `eval` reports, but the
privacy-minimized reports do not identify a specific call site.
The phase-2d PR rewrites the five string-evaluation calls as directly
invoked functions, retaining the original lexical variable ownership,
feature flags, guards, and return paths; the bridge bodies are
otherwise unchanged. A fail-closed source validation checks that no
production bridge reintroduces `eval` or `new Function`, and a
real Next browser/routing suite checks ordinary functionality.

**Staging acceptance:** after a protected production deployment,
monitor the CSP report categories for the players page and test
Database filters (especially nationality and numeric steppers), table
selection reset after refresh, and mobile page-size restoration.
If a browser reports regressions, revert this separate bridge change
without weakening the CSP policy.

**Do not infer that all `eval` violations are resolved** without a
post-deploy browser sample; other external/extension code may use
string evaluation. Keep `script-src` in Report-Only, and do not
enable `MFL_CSP_NONCE_REPORT_ONLY` or introduce `unsafe-eval`
on the strength of source scans alone.

## Phase 2c (01 October 2026): wire the CSP receiver into production

**Deployment verification found a routing gap.** The phase-1 report
receiver existed at `api/csp-report.js`, but the Next Pages Router did
not have a matching `pages/api/csp-report.js` adapter. Unlike other
production API routes, CSP browsers therefore had no direct Next endpoint
with the intended 405/204 response contract. Without this route, a
successful build or source-only unit test cannot establish that violations
are actually collected.

The follow-up change supplies the wrapper, explicitly sets
`api.bodyParser=false` (required to preserve the receiver's own 16-KiB
body cap and two browser report formats), and adds **HTTP-level** tests
against both a real Next development server and a built production server:
- GET is 405 with `Allow: POST`, not an HTML fallback;
- empty valid `application/csp-report` JSON and modern
  `application/reports+json` arrays each return HTTP 204, without
  persisting or generating synthetic violation logs;
- malformed JSON returns 400, oversized bodies 413, and unsupported
  media type 415;
- deployed HTML retains unchanged enforced CSP, includes the report-only
  `script-src` and `report-uri /api/csp-report`, and exposes the
  `Reporting-Endpoints` header.

The protected `Vercel site update` workflow now includes these
**live post-deployment checks** after database identity and deep-link
validation. A deployment cannot report successful verification without
a reachable and accepting CSP reporting endpoint. This remains
observability-only; it introduces no enforced script CSP or new wallet
permissions.

The deployment on commit `1504d4f3` completed successfully on
01 October 2026, but predates the route adapter. Deploy the fix through
the protected workflow and then observe sanitized reports and exercise
a real Dapper session before considering enforcement.

## First-party report processing

`POST /api/csp-report` supports:
- `application/csp-report` JSON with `csp-report` for legacy `report-uri`;
- `application/reports+json` arrays with `type=csp-violation` for Reporting API.

It accepts a maximum 16 KiB body and processes at most 10 reports per request.
It logs at most 24 normalized report summaries per server instance per minute.
Invalid JSON returns 400, oversized reports 413, unexpected content types 415
and non-POST requests 405.

**Privacy:** the logger stores only the effective directive, the blocked
source's origin or a fixed token (`inline`, `eval`, `data`, etc.), and a
known **first-level route category** (not player/club IDs). It never logs
raw IPs, cookies, script samples, referrers, source code, full URLs, paths
within third-party origins, query strings or the original policy. Raw
incoming reports are not persisted. Reports are untrusted and may be
spoofed; samples are an operational diagnostic, **not authoritative proof**
of an attack or an exact violation count.

Review the rate and retention of these structured events in Vercel logs after
initial deployment. The cap is per instance, so a platform WAF or a
central telemetry sink would be needed for global aggregation/abuse resistance.

## Staged rollout and acceptance gates

1. **Phase 1 — this PR:** Deploy Report-Only only, with privacy-aware receiver.
   Verify enforced CSP stays byte-for-byte unchanged. Test GET/POST endpoint
   behavior, both report formats, browser route/deep-link regressions, fonts,
   images, skeletons and Next development environment. No new cookies or
   session changes.
2. **Observe:** On the deployed site, exercise Home, Database, Table, Players,
   Evaluation, Planner, shares, settings, popups and mobile navigation.
   Authenticate with a real Dapper wallet, then opt out. Inspect
   `MFL CSP report-only violation` logs for unexpected blocked origins and
   distinguish expected Next/legacy inline reports. Collect a written
   inventory without logging sensitive URLs. No claim of 'zero violations'
   is justified before these flows have been exercised.
3. **Phase 2 — separate PR:** Decide on CSP nonces vs stable script hashes,
   migrate inline scripts and inline event handlers to sourced files or
   nonce-compatible markup, identify dynamic CDN and Flow/Dapper sources
   precisely, and reduce report-only warnings. Include deterministic
   Next/legacy build tests and Dapper popup tests.
4. **Phase 3 — separate, explicitly approved PR:** Apply the reviewed,
   narrowly scoped *enforced* directives only after observing no unexpected
   violation across the test matrix. Keep rollback via a header-only revert.
   Never silently turn Report-Only into enforcement.

For HTTP behavior, see [MDN CSP Report-Only](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy-Report-Only)
and [MDN Reporting-Endpoints](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Reporting-Endpoints).

## Rollback

Revert the two report-only response headers and disable/remove
`/api/csp-report`. This phase has no Supabase migration, no persistent data,
and no change to the enforced CSP. Application authentication and private
wallet session flows remain unaffected.
