# LOAD-03 — Planner Player search race fix (#1034)

**Clean reconstruction:** 2026-10-05 on `main` `47178ebd2db3ee5f1f465a6f2326950ab6132e1c`. PR #1114 remains diagnostic/test-only evidence; PR #1115 remains the original stacked implementation and is not part of this branch history. No database refresh, wallet/account action, Supabase change or Vercel deploy.

## Evidence

The isolated baseline reproduced one Planner Player race during the existing 140 ms debounce: an older request could settle after a new edit but before the replacement request started. That leaked an obsolete error/empty state, and accent-equivalent edits such as `José` → `Jose` could apply the stale payload because only normalized text was compared.

## Targeted change

- invalidate the Player-search sequence on every edit;
- abort the previous Player fetch immediately with one owned `AbortController`;
- show `Searching players…` while the replacement query is pending;
- render an empty state only after a successful latest response;
- on current HTTP/network failure, clear obsolete rows and keep the actionable error without claiming zero results;
- keep pagination, normalization, page size, server search behavior and the existing 140 ms debounce unchanged.

Global Search, Planner Team search and Evaluation remain **NO CHANGE**; the fixture executes their existing stale-response/abort contracts as regressions.

## Verification

`validation/load03-search-race-isolation.mjs` executes canonical source owners with fake timers and deferred responses. It requires zero obsolete Player errors/empty renders, zero stale accent-equivalent payloads, actual request aborts, authoritative-empty-only behavior, current error feedback, clear-input cancellation, Planner Team stale suppression and Evaluation latest-only abort behavior. The dedicated workflow also runs the existing Global Search debounce/empty/error validators.

These are deterministic synthetic checks, not real Safari/iPhone, wallet, production network or backend rate-limit measurements. Real-device checks remain at the final issue gate.

## Decision

Integrate only the Planner Player race fix after exact-head CI. Do not import #1114 history or unrelated generated artifacts; no merge without explicit maintainer approval.
## Generated artifact synchronization

Site Quality on user head `f19cef6529115d74d93a864d1ee09773a09e6e5b` passed the application/browser gates and produced CI-owned commit `a36c75f85c5555192cb6a510662b01c7a04518eb`, changing only the derived `table-width-runtime.js` core build ID. This documentation commit retriggers the full exact-head workflow set on the synchronized generated state; it changes no application behavior.
