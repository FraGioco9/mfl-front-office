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

This intentionally **does not** cover Next.js request-dependent bootstrap
scripts, third-party/runtime dynamically generated inline scripts, inline
event handler attributes or inline style attributes. The existing report-only
candidate may still report these. An enforced `script-src` with only the
legacy hashes would break Next unless those sources receive a separately
verified request nonce (or other approved mechanism). The check is intentionally
limited to deterministic legacy scripts; no nonce is added or assumed.

**Observability blocker:** As checked on 01 October 2026, the most recently
listed Vercel production deployment was still at `00c69330`, preceding
phase 1's reporting header. Real CSP violation statistics and Dapper popup
source inventory therefore cannot yet be inferred. Production deployment
and a real browser/wallet exercise remain prerequisites for narrowing dynamic
origins or enabling enforcement.

**Rollout:** After deploying and verifying phase 1/phase 2a, inventory
remaining `script-src`, `script-src-elem` and `script-src-attr` reports.
Keep the enforced header byte-for-byte unchanged. If rendered HTML differs
from source bytes, fix the source-to-renderer contract, **not** by enabling
`'unsafe-inline'`.

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
