# Content Security Policy

MFL Front Office currently enforces only the compatibility-safe baseline:

`Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none'`

Production also emits a stricter **Report-Only** candidate. It is telemetry, not enforcement:
violations must never be interpreted as blocked product behavior.

## Current ownership

- `next.config.mjs` owns the application security-header contract.
- `csp-report-only-policy.mjs` owns the Report-Only directives.
- `vercel.json` mirrors the reviewed edge headers and is checked for drift.
- `/api/csp-report` receives both legacy and Reporting API formats, bounds request size and logs only sanitized origin/category information.
- `csp-legacy-script-hashes.mjs` derives the reviewed parser-time inline-script hashes from generated HTML.
- `csp-legacy-hash-snapshot.mjs` is the checked-in snapshot consumed by the runtime/Next configuration.
- `proxy.js` and `pages/_document.js` contain the opt-in request-nonce experiment used only when `MFL_CSP_NONCE_REPORT_ONLY=1`.

## Allowed compatibility surface

The application currently depends on first-party scripts plus Flow/Dapper/MFL and font resources.
Known external destinations include:

- `https://esm.sh`
- `https://fcl-discovery.onflow.org`
- `https://rest-mainnet.onflow.org`
- `https://api.playmfl.com`
- `https://fonts.googleapis.com`
- `https://fonts.gstatic.com`

Wallet/discovery destinations can vary. Do not replace the broad Report-Only observation policy with a guessed fixed allowlist.

## Enforcement rule

Do **not** add enforced `script-src`, `style-src`, `connect-src` or `img-src` restrictions merely because static/source validation passes.

Any stricter enforcement requires all of the following:

1. exact generated-html/hash/nonce validation;
2. production-like browser coverage;
3. a real Dapper/FCL sign-in, cancel/reject, refresh and logout flow;
4. CSP report inspection for unexpected first- and third-party sources;
5. an explicit rollback path.

The real Dapper acceptance gate for the current Report-Only policy passed after the v1.129.0 production deployment. This validates compatibility of the present policy; it does **not** authorize stricter enforcement.

## Nonce experiment

The nonce path is intentionally opt-in and Report-Only. Request-scoped nonces must never be attached to cacheable static HTML. Enabling `MFL_CSP_NONCE_REPORT_ONLY=1` is a dedicated test-deployment action, not the default production configuration.

## Maintenance

When parser-time inline scripts change, regenerate and review the hash snapshot:

```powershell
node scripts/workflows/refresh-csp-legacy-hashes.mjs --check
```

Use the write mode only after reviewing the script-count/hash change. Never solve a mismatch by adding `'unsafe-inline'` or `'unsafe-eval'`.
