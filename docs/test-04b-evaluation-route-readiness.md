# TEST-04B — Evaluation SPA route-commit readiness fix

## Reproduced cause (same-runner A/B)

Evidence: [diagnostic PR #1102](https://github.com/FraGioco9/mfl-front-office/pull/1102) on head `a3f8c3eb8f7d8c3b1c4cf7aeb8438b4d679a1960`, [Site Quality #37139227901](https://github.com/FraGioco9/mfl-front-office/actions/runs/37139227901), **9/9 workflows and 17/17 jobs passed**.

Using the **same Chromium CI runner, canonical browser-routing source, and authentic Evaluation runtime**, only the artificial local API endpoint was provided by the test fixture:

| Mode | Player→Evaluation elapsed | mfl:evaluation-rate-settled events | mflEvaluationRateSettled |
| --- | ---: | ---: | --- |
| A: original programmatic SPA navigation | 15,160ms | 0 | false |
| B: call `__mflEvaluationDiscountRateRuntime.sync()` after Evaluation route commit | 175ms | 1 | true |

**Savings 14,985ms per tested navigation**, without shortening the 15,000ms fail-safe or synthesizing the event. Diagnostic #1101 on head `e0e796599cc935703e318b2deee073fda7e501a6` separately confirmed all 12 Player width scenarios spent about 15.16s in this same phase.

The runtime's own `sync()` runs at script initialization while Player still owns the route, then watches clicks, `popstate`, storage and `mfl:ready`. `window.history.pushState` at an SPA route commit does **not** emit `popstate`; programmatic navigation can therefore leave the request unscheduled even though the rate-ready gate is awaiting it. The source code responsible is shared by real navigations, not a test-specific mock. **No claim is made about live Supabase response time or currently deployed code**, because production connectivity is not part of this isolated A/B.

## Narrow production change

In `modules/core-sources/shared-transitions.js`, call the already-existing Discount Rate `sync()` after `commitPageTransition()` has committed Evaluation. Do **not** change the data fetch, authority, discount formula, timeout guard, other routes, or navigation tokens. The function itself is already idempotent when a rate request or result is active.

Add a Chromium validator `validation/browser-evaluation-rate-route-commit.mjs` that reuses all of the canonical Player navigation/layout/accessibility assertions and verifies the real rate-ready event (exactly one), `mflEvaluationRateSettled=true`, source `supabase-live-request` and completion under 5,000ms. No injection of a ready event or manual `sync()` inside this regression.

A dedicated Site Quality step runs the validator. Compare its exact-head full browser routing step duration against pre-fix controls (typically 213–219 seconds). Do not interpret a one-run speedup as universal performance certainty; continue TEST-04B/TEST-04 observation.

## Rollback and exclusions

Revert the specific route-sync invocation plus validator/workflow/report, requiring no database or Vercel actions. No merge, live database refresh, Supabase configuration changes or Vercel deployment are authorized at this stage.
