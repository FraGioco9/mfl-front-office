# Architectural guardrails

This document records repository-level constraints that intentionally shape how MFL Front Office is maintained. Product limits such as watchlist counts, search-result counts, request retries, rate limits, payload sizes, and cache TTLs are not architecture guardrails and are documented with their owning feature/API instead.

## Decision rule

Keep a hard repository limit only when crossing it would create a clear architectural or operational failure mode: larger universal runtime cost, source/generated drift, competing writers, broken first-paint ordering, extra production requests, or unsupported runtime behavior.

Do not use byte count alone as a proxy for good ownership inside a route/domain module. A domain source should be split when responsibilities, readability, testability, or route cost justify the split.

## Retained guardrails

### Universal shared-core ceiling — keep

- **Threshold:** the manifest-assembled Shared domain may not exceed **355,000 UTF-8 bytes**.
- **Enforced by:** `site/modules/core-source-manifest.js`, `site/build-app-core.mjs`, and `site/validate-core-source-ownership.mjs`.
- **Reason:** the assembled Shared domain is universal code. Growth anywhere in its manifest-owned fragments affects every route and can silently pull route-specific responsibilities back into the common runtime.
- **Why 355,000:** this is the explicit post-decomposition upper boundary already recognized by the ownership validator. It is intentionally a stable architectural ceiling, not a moving snapshot of the current file size.
- **Recommendation:** keep. If the ceiling is reached, first move non-universal behavior to the owning route/domain. Raise it only for behavior that is demonstrably universal and cannot be owned elsewhere without increasing coupling.

### Route/domain core byte ceilings — removed

The former hard limits were:

| Domain | Former hard ceiling |
| --- | ---: |
| Evaluation | 80,000 bytes |
| MFL Stats | 12,000 bytes |
| Club | 20,000 bytes |
| Settings | 22,000 bytes |
| Player | 95,000 bytes |
| Table | 110,000 bytes |
| Wallet | 24,000 bytes |
| Watchlist | 10,000 bytes |

These values were useful immediately after splitting the old application-core monolith, but they became brittle maintenance gates. In particular, Player was within a few hundred bytes of its ceiling despite being correctly route-owned. A route-owned file getting larger is not automatically an architectural regression because it is not universal code.

- **Replacement:** canonical ownership, lazy route loading, generated-runtime equality, lint/typecheck, and domain regressions remain mandatory.
- **Recommendation:** removed. Split a domain module for ownership/readability/performance reasons, not because a fixed byte counter reached an arbitrary historical threshold.

### Canonical source → generated runtime equality — keep

- **Threshold:** generated `site/modules/app-core-*-runtime.js` files must exactly equal their canonical `site/modules/core-sources/*` owner plus the generated banner.
- **Enforced by:** application-core build and ownership validation.
- **Reason:** prevents hand-edited generated code, source/runtime drift, and nondeterministic releases.
- **Recommendation:** keep.

### Canonical HTML fragments — keep

- **Constraint:** edit `site/html-sources/*`; `site/index.html` is generated.
- **Reason:** route shells and parser-time first-paint logic need deterministic source ownership while preserving inline execution order and zero-request first paint.
- **Recommendation:** keep.

### Canonical responsive fragments and cascade order — keep, revisit only with a cascade redesign

- **Constraint:** `site/responsive-sources/manifest.json` defines lexical fragment order; `.css.inc` fragments may participate in media blocks that cross fragment boundaries.
- **Reason:** preserves the production cascade exactly while allowing ownership to be split by responsive domain.
- **Risk:** changing fragment order casually can alter specificity/cascade behavior without changing individual rules.
- **Recommendation:** keep for the current CSS architecture. Replace only as part of an intentional cascade/layer redesign.

### Flattened production stylesheet — keep

- **Constraint:** generated `site/styles-runtime.css` must match the canonical CSS graph and contain zero nested `@import` rules.
- **Reason:** production serves one primary stylesheet and avoids extra dependency requests/order races.
- **Recommendation:** keep.

### Single generated-artifact writer — keep

- **Constraint:** Site Quality owns generated site-artifact commits/checks.
- **Reason:** prevents multiple workflows from racing to generate different PR heads or release projections.
- **Recommendation:** keep.

### Node.js 22 runtime — keep while `node:sqlite` is required

- **Threshold:** `site/package.json` requires Node `22.x`.
- **Reason:** the runtime database path depends on the supported Node SQLite runtime/API used by the application.
- **Recommendation:** keep until the runtime/database implementation changes or a later Node line is deliberately adopted and validated.

### SQLite / Supabase ownership boundary — keep

- **Constraint:** MFL dataset/query workload belongs to SQLite; wallet-scoped private state such as preferences, watchlists, notes, evaluations and bug reports belongs to Supabase.
- **Reason:** separates the large read-heavy game dataset from authenticated user state and avoids duplicating authoritative ownership.
- **Recommendation:** keep unless the storage architecture itself is redesigned.

### Performance enforcement boundary — keep

- **Constraint:** normal Site Quality enforces deterministic performance architecture, not browser wall-clock milliseconds.
- **Reason:** cache ownership, request ordering, route/runtime scoping and nonblocking dependency rules are stable source/runtime contracts; elapsed browser timings vary with hardware, scheduling, fixture latency and throttling.
- **Owner:** `site/validate-performance-foundations.mjs` plus focused browser-routing regressions.
- **Timing evidence:** use the opt-in `npm --prefix site run performance:baseline` harness for measured runtime changes; do not add it to the ordinary PR quality workflow.
- **Recommendation:** add a CI invariant only when the behavior is deterministic enough to distinguish an architectural regression from environmental noise.

### Root local-development entry point — keep

- **Constraint:** root `package.json` owns `npm run dev` as the canonical local startup command and delegates directly to `vercel dev --cwd site --listen 4000` so Vercel resolves the actual site project instead of recursively rediscovering the root npm script.
- **Reason:** developers should not need to remember platform-specific `vercel.cmd` syntax or a site subdirectory command, while Vercel remains the one local runtime owner.
- **Boundary:** local startup does not rebuild the SQLite database and does not regenerate tracked site artifacts. Database preparation remains explicit; Site Quality remains the generated-artifact writer.
- **Recommendation:** keep the wrapper thin. Add behavior only when it is genuinely required for every local startup.

### Workflow YAML / script ownership boundary — keep

- **Constraint:** workflow YAML owns triggers, permissions, credentials, environment and artifact boundaries; reusable implementation belongs under `scripts/workflows` and domain scripts.
- **Reason:** keeps CI orchestration auditable while making implementation logic testable outside GitHub Actions.
- **Recommendation:** keep.

## Temporary compatibility constraint

### TypeScript 6 compiler alias — keep temporarily

- **Current state:** both `typescript@7` and `@typescript/typescript6` are installed.
- **Reason:** the generated-binding validator requires compiler APIs such as `createSourceFile` that the currently installed canonical TypeScript 7 package does not expose compatibly in this repository.
- **Recommendation:** remove the alias once the canonical TypeScript package provides equivalent parser/AST behavior and the binding validator passes with equivalent diagnostics.

## What should not become an architecture guardrail

Do not add repository-wide hard ceilings merely because a file, table, route, workflow, or test suite has grown. Prefer a direct invariant tied to the real failure mode:

- universal loading/coupling → shared-core ownership;
- generated drift → exact generated equivalence;
- route cost → lazy ownership/performance checks;
- maintainability → split by responsibility;
- external-service protection → feature/API-specific rate, size, timeout, or retry limits.

This keeps CI strict about architecture without turning historical measurements into permanent development blockers.
