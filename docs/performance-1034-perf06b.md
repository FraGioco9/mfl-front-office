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

## Captured mobile-slow results — 3 October 2026 (completed)

The first attempt [run #37144762791](https://github.com/FraGioco9/mfl-front-office/actions/runs/37144762791) completed Player and Club measurements, but failed on the guest Planner canonical route because it expected `/planner` instead of the actual `/planner/opted-out`. The harness expectation was corrected without altering the application or bypassing opt-in.

The second attempt [run #37144910896](https://github.com/FraGioco9/mfl-front-office/actions/runs/37144910896) **succeeded** on source head `2c138819c912578dc274bb2885a12d309b801477`, using read-only pinned snapshot generated `2026-10-02T17:17:23.160Z`, **Google Chrome 154.0.8037.57**, synthetic 390px mobile-slow (4× CPU, 150ms latency, 200,000 bytes/s down), two completed repetitions for every journey. These are **median CDP** image requests/transferred bytes, not all page traffic:

| Journey | Cold image requests | Cold image bytes | Refresh requests | Refresh bytes | Cached SPA image requests / bytes | Scroll extra requests / bytes |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Player | 5 | 113,042.5 B | 5 | 0 B | 0 / 0 B | 0 / 0 B |
| Club | 26 | 75,251.5 B | 26 | 2,339 B | 0 / 0 B | 0 / 0 B |
| Planner guest opt-out | 0 | 0 B | 0 | 0 B | 0 / 0 B | 0 / 0 B |

No image fetch **failures** were recorded in those samples. In refresh, Chrome reports five Player image cache events and 25 Club image cache events (medians); image request events include browser-cache-served objects and must not be confused with new network transfers. Cold-to-refresh byte changes are paired **phase comparisons**, not an experimental performance optimization of this PR.

| Route | Cold visually settled median | Refresh settled median | Cached settled median | Explicit DOM decode after settle: sample count / median |
| --- | ---: | ---: | ---: | --- |
| Player | 1,883.8ms | 805.75ms | 202ms | 2 DOM images / 2.9ms |
| Club | 2,311.8ms | 1,371.75ms | 154.55ms | 16 DOM images / 1.15ms |
| Planner guest | 1,238.1ms | 377.4ms | 90.5ms | 0 images / 0ms |

The Player hero is an off-DOM `new Image()` painted to canvas, and its decode is **not** measured by `document.images`. The explicit decode duration here is **post-load**; it cannot be used to infer LCP or critical-path image decoding. Planner guest is opted out, and zero pictures cannot represent a genuine populated roster. The test scroll returned zero additional image requests across all six samples, which **does not establish** scroll behavior in a full Planner lineup or future production CDN conditions.

**Decision:** these measurements demonstrate effective cache behavior on sampled Player and Club revisits (zero additional image transfer), but show **no evidence-based improvement worth implementing in application code** on this PR. In particular, changing Player hero priority, Planner `loading=lazy`, image compression or preview cache from these samples would be speculative. Further authenticated Planner fixture and real-device raster/decode tests remain required for release.

The first report's `sourceCommit` value was the GitHub Actions synthetic merge SHA rather than the PR's source head. The diagnostic workflow has since been corrected to record `github.event.pull_request.head.sha` explicitly on subsequent captures, avoiding incorrect provenance.

## Validations and release

- [x] Dedicated pinned-snapshot [run #37144910896](https://github.com/FraGioco9/mfl-front-office/actions/runs/37144910896) captured two full repetitions with Player/Club and **guest opt-out Planner**. Documented actual counts, bytes, failures and scroll.
- [x] Paired cold/refresh/cached/scroll observations reviewed: **no application change justified**; additional test-only authenticated Planner evidence remains a follow-up if needed. No separate production PR.
- [ ] Full exact-head ordinary Site Quality, Mobile (including Age/Listing), Table Header and A11Y workflow checks green; do not mistake a `action_required` bot run for success.
- [ ] Document slow-mobile/DPR/scroll/revisit/failure limits; **PERF-06.5** and **TEST-04B6.6** remain pending for final real-device Safari/iPhone release QA.

**No merge of this diagnostic PR, no refresh/shared DB changes and no Vercel deployment.**
