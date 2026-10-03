# PERF-06B — Independent cold/scroll image audit (Player, Club, Planner)

## Scope, provenance and limits

- Source: `main` after merged PERF-06A [`3f520451`](https://github.com/FraGioco9/mfl-front-office/commit/3f5204515c4e5d51ac278f6bbee13bb5527290b4).
- **No production UI or loading strategy modification**. The optional `MFL_PERF06B_IMAGE_AUDIT=1` branch in `validation/performance-baseline.mjs` appends CDP image request/status/transfer/cache diagnostics, plus a scroll-after-cold phase and a clearly labeled explicit `IMG.decode()` test after settlement. The normal PERF-01 baseline remains unchanged when the flag is absent.
- Read-only, pre-existing pinned validated snapshot: [workflow run 37038069396](https://github.com/FraGioco9/mfl-front-office/actions/runs/37038069396), artifact `mfl_database` ID **11242500512** (not expired when checked 3 Oct 2026). The workflow **downloads** this artifact and starts a disposable local production Next. It never refreshes, mutates or migrates the shared DB, or deploys to Vercel.
- Dedicated `.github/workflows/perf06b-image-capture.yml` runs on the diagnostic PR. The runner captures **two repetitions of Player, Club and guest Planner under the existing `mobile-slow` synthetic profile**. Cold/refresh/cached are the established PERF-01 phases; the scroll phase is an A/B-style paired follow-up after cold on the *same* page/profile and code.
- Image classification: CDP `Network.requestWillBeSent` with resource type Image and/or image file extensions, `Network.responseReceived`, `loadingFinished`, `loadingFailed`, and `requestServedFromCache`. The benchmark reports cross-origin image successes/failures as observed, not fictitious byte savings.
- Decode probe calls `img.decode()` only on up to 16 **visible, successfully completed DOM IMG elements after settlement**. This is a **warm explicit decode probe**, not critical-path decode duration. Player hero uses an off-DOM `new Image()` drawn onto canvas, so its critical-path decode is **not covered**; do not label it Player image LCP. External media CDN unavailable in CI may produce errors; keep them visible.
- Planner is opt-in gated; in **guest** mode it may display no occupied position portraits. An observed zero request count for Planner guest is **not evidence that populated Planner image loading is free**. Report the coverage gap and retain real-account tests for final release.

## A/B reporting and decision criteria

| Isolated comparison | Metric | Requirement before optimizing |
| --- | --- | --- |
| A cold vs B refresh/cached | Image requests and encoded transfer, response status/cache | Same source/runner/profile; do not confuse CDN failures with a cache win |
| A initial viewport vs B scroll | Incremental image requests/bytes and timeout | Verify scroll actually reached a populated image surface; distinguish empty guest Planner |
| DPR/image decode | Explicit visible DOM image decode duration/count | Do not claim canvas/off-DOM Player decode or memory measured |
| Existing PERF-06A LRU | 128 vs 16 strongly retained `Image` refs | Already measured and merged; not evidence of faster byte transfer or LCP |

**Initial state:** results not yet available. Do not implement eager loading, `fetchPriority`, `srcset`, WebP resizing, image proxying, or social-preview caching without a repeatable same-runner test establishing a meaningful benefit without layout/fallback/ownership regressions.

## Validations and release

- [ ] Dedicated diagnostic workflow completes all Player/Club/Planner journeys and scroll observations; report actual errors, image request counts and transferred bytes.
- [ ] Verify A/B-style paired measurements; document whether an application change is warranted. If a production fix is supported, use a **separate PR** with regression tests and its own exact-head CI.
- [ ] Full exact-head ordinary Site Quality, Mobile (including Age/Listing), Table Header and A11Y workflow checks green; do not mistake a `action_required` bot run for success.
- [ ] Document slow-mobile/DPR/scroll/revisit/failure limits; **PERF-06.5** and **TEST-04B6.6** remain pending for final real-device Safari/iPhone release QA.

**No merge of this diagnostic PR, no refresh/shared DB changes and no Vercel deployment.**
