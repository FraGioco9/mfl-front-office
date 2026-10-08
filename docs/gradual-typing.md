# ARCH-02 — gradual typing plan

Scope: issue #1034. The goal is to improve type safety at high-value boundaries without a risky repository-wide `strict` flip.

## Implemented in ARCH-02

The canonical browser runtime remains JavaScript with `checkJs`, while named contracts are introduced in `types/global.d.ts` and consumed through JSDoc at runtime boundaries:

- `MflDataClientRequestOptions` — request dedupe/cache options for the canonical data client.
- `MflRouteOptions` — route/navigation options shared by path construction, lazy route gates and incremental route loading.
- `MflIncrementalTableFilters` and `MflIncrementalRoute` — normalized route/data-query ownership.
- `MflIncrementalPayload` — the response shape crossing incremental cache/generation boundaries.
- `MflTableSortState` — canonical Table sort key/direction state.

Typed JSDoc is applied to `shared-routing.js`, `shared-incremental-routing.js`, `shared-route-runtime-gate.js` and `shared-table-state.js`. These comments are erased behaviorally: they do not create browser requests, runtime branches or serialization changes.

## Diagnostic ratchet

`check-core-types.mjs` remains the authoritative TypeScript diagnostic gate. Its fingerprint baseline already rejects new diagnostics even when total count is unchanged. ARCH-02 additionally guards the baseline ceiling:

- accepted diagnostic total may remain at or below **288**;
- accepted fingerprint count may remain at or below **253**;
- the baseline may be ratcheted downward when diagnostics are resolved;
- increasing either ceiling is not an allowed way to make a change pass.

Global `strict:false` and `noImplicitAny:false` remain explicit. Claiming strict migration completion would be inaccurate while the legacy lexical core still carries tracked diagnostic debt.

## Next migration order

Future work should migrate only one boundary at a time:

1. API request/response payload records that currently use broad `unknown` fields.
2. Route-specific option unions and canonical page/view names.
3. Table filter-rule payloads and saved-state persistence.
4. Evaluation/Planner payloads after their contracts stabilize.
5. Finally, consider a strict sub-project or per-file `@ts-check` tightening where diagnostics are already zero.

Each step must keep `npm run typecheck`, repository validation and behavior regressions green without growing the diagnostic baseline.
