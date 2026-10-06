# DEP-01 — dependency and lockfile audit

**Result: NO CHANGE dependencies.**

Audit date: 2026-10-06.

## Reviewed baseline

- Node: `22.x`
- Next: `16.3.6`
- React / React DOM: `19.3.0`
- ESLint: `10.11.0`
- transitive `brace-expansion`: `5.0.12`

The committed `package-lock.json` resolves these versions with integrity hashes and license metadata. React DOM's peer range accepts the installed React version.

## Security review

Next 16.3.6 is the patched boundary for **GHSA-vcvr-r3jv-pc5j** affecting earlier Next 16.2.x–16.3.5 releases.

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
