# Dependency security and lockfile contract

**Result: Next security baseline updated to 16.3.8.**

## Reviewed baseline

- Node: `22.x`
- Next: `16.3.8`
- React / React DOM: `19.3.0`
- ESLint: `10.12.0`
- transitive `brace-expansion`: `5.0.12`

The committed `package-lock.json` resolves these versions with integrity hashes and license metadata. React DOM's peer range accepts the installed React version.

## Security review

Next 16.3.8 preserves the earlier **GHSA-vcvr-r3jv-pc5j** fix and adds the current security release fixes, including HIGH-severity Image Optimization SSRF **GHSA-cjq9-62q9-8jv4** plus the additional cache/metadata and development-server advisories included in 16.3.8.

Recent brace-expansion denial-of-service advisories patched the 5.x line before the currently locked **brace-expansion 5.0.12**. No downgrade or override is required.

No major/version upgrade is introduced solely for freshness. Dependency changes should remain evidence-driven and receive the normal Next dev/prod and browser smoke gates.

## Guardrail

`validate-dep01-lock-contract.mjs` verifies:

- package.json ↔ package-lock root dependency parity;
- Node 22 contract;
- direct dependency lock entries and license metadata;
- React/React DOM alignment and peer compatibility;
- reviewed security floors for Next and brace-expansion.

Network-backed registry/advisory checks remain an audit-time/release activity rather than a flaky assertion in every Site Quality run.
