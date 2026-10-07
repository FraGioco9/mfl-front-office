# PERF-06 — Image, avatar and preview asset audit (issue #1034)

**Scope:** repository audit + **one narrowly scoped** Player-hero image retention change. No deployment, shared database refresh, live media download or change to canonical social-share rendering.

## Image route inventory (source of truth)

| Surface | Source and loading strategy | Evidence and decision |
|---|---|---|
| Player hero portrait | `modules/core-sources/player.js` uses `Image()` with WebP `/players/v2/:id/photo.webp`, `decoding=async`, `fetchPriority=high`, and draws a retina-scaled **cropped canvas**. | This is the primary player media and correctly receives high priority; keep it. `applyPortraitGeometry` reserves width/height even while pending. An unbounded `portraitSources = new Map()` permanently retained each previously visited player's `HTMLImageElement` reference during a SPA session. Bounded retention is justified independently of network speed. |
| Club branding | `modules/core-sources/club.js` sets a WebP logo on a hidden/visible frame with async decode and fallback to non-versioned URL if the versioned asset fails. Player hero brand mark also uses an `img`. | Avoid changing priorities without real first-paint and loading data, and preserve broken-logo fallback. |
| Planner assigned lineup | `html-sources/planner.html` creates a lazy WebP `img` per occupied position; pitch gradient remains behind photo. | Existing `loading=lazy` avoids eager loading on offscreen surfaces. No change without Chromium/real-mobile first-paint evidence. |
| Planner selection popup | `html-sources/planner.html` creates each portrait as `img loading=lazy` and hides failed images. | Keep lazy loading and error state; no speculative `fetchpriority=high` on lists. |
| Flags and retirement icons | SVG from Twemoji CDN and local icon assets, small retirement markers. | No proven cost; preserve accessibility and current breakpoint sizes. |
| Evaluation social previews | `api/_handler-evaluation-preview-image.js` renders a PNG via `api/_evaluation-preview-card.js` and PureImage/fonts/bitmap code; OG metadata defines a **2400×1260** graphic. | Server-side social media request, not the interactive Player-page LCP. Existing `Cache-Control: no-store` preserves share privacy/revocation semantics; no change until isolated server cold/warm render, image-byte comparison and cache security tests exist. |

## Existing measured route baseline (not an image-specific measurement)

The five-run 2 October [PERF-01 baseline](../performance-baselines/2026-10-02-perf01.json.gz) on a simulated slow-mobile connection reported Player **cold useful 1820.1ms, settled 1935.2ms, cached useful 173.8ms, settled 200.1ms**, with cold transferred **650,925 bytes** (total page, not portrait bytes). It does **not** isolate WebP download, raster decode, LCP or memory and therefore does not support compressing WebP again or changing first-paint priority.

## PERF-06A — Capped Player image references, same-runner A/B

**Before:** the actual Player source cached each unique `Image()` in an unbounded `Map` with no eviction. In a long-lived application tab, each different Player page added another strong `HTMLImageElement` reference. Raster-byte cost is browser-dependent, but the unlimited source retention is structurally demonstrable.

**Change:** keep at most **16 most recently used Player portrait sources**, promote a recent hit on revisit, evict only the least-recently-used image reference, and let the browser's existing HTTP cache manage any later reuse after eviction. Retain the Player-hero `fetchPriority="high"`, async decode, source WebP URL, same image crop and canvas geometry. Ensure a late load callback cannot paint an old Player onto a newer hero canvas. Release a failed source so it can be retried. On resize, lazily reload an evicted active portrait before redrawing. This does **not** prefetch more media or add server calls on initial load.

**Controlled A/B:** `validation/perf06-portrait-cache-ab.mjs` extracts the **actual Player source loader and cache helpers** into identical Node/vm fake-browser runners. A removes only the eviction loop; B keeps production 16-source LRU. Traverse 128 distinct Player IDs, then revisit the 16 most recent; assert identical initial source creations and warm revisit counts. Assert bounded retained references, correct eviction behavior, bad-image retry and a stale asynchronous portrait never overwriting a newer one. The comparison reports **retained Image references**, *not* measured process heap, LCP, transfer bytes, or decoded image raster memory. Real-browser Player navigation tests continue unchanged in Site Quality.

| Metric, 128 synthetic distinct Player visits | A: unlimited sources | B: cap 16 |
|---|---:|---:|
| Strong `Image` references retained | 128 (expected) | 16 (expected) |
| Initial `Image` source creations | 128 (expected) | 128 (expected) |
| Extra creations revisiting 16 recent portraits | 0 (expected) | 0 (expected) |
| Revisit first evicted older portrait | 0 (expected) | 1 (expected; HTTP cache may satisfy it in a real browser) |

**Measured results on the same CI runner (confirmed).** [Site Quality #37143064420](https://github.com/FraGioco9/mfl-front-office/actions/runs/37143064420), source SHA `330369b05b6c71137e0e79f3de5e2e3909b44ea8`, completed successfully. The test printed:
```
PERF06_AB_RESULT {"distinctPlayers":128,"sameRunner":true,"baselineStrongImageReferences":128,"boundedStrongImageReferences":16,"retainedReferenceReductionPercent":87.5,"coldImageCreationsBothModes":128,"last16WarmExtraRequestsBothModes":0,"oldPlayerRevisitExtraImageInstances":1,"staleLoadBlocked":true,"failedImageRetry":true}
```
This is **87.5% fewer retained image references in the controlled A/B**, not 87.5% less decoded browser memory. Both modes keep initial requests equivalent and the 16 most recent warm. The deliberately evicted 17th-oldest Player causes one new `Image` allocation when revisited; whether actual bytes transfer depends on the browser/CDN HTTP cache. The first full source-head CI had **9/9 workflows green**, and Site Quality's `quality` plus Windows smoke succeeded. A GitHub Actions bot subsequently regenerated `modules/app-core-player-runtime.js` and `table-width-runtime.js`; require a fresh complete exact-head CI after the report's final update.

## Remaining PERF-06 gates

- [x] Same-runner A/B source benchmark **green** with reported 128→16 references and 87.5% lower reference retention, warm recent visits unchanged, stale and error cases green.
- [ ] Full Site Quality `quality`, Windows Next smoke, Mobile 8/8 including `responsive-table-resize` + Player/Planner, Table Header and A11Y exact-head green. If CI regenerates app core assets and advances PR head, re-run CI on final new head.
- [ ] Cold/scroll representative **real mobile** Player/Club/Planner testing deferred to the final Safari/iPhone release gate; record LCP/CLS, DPR1/2, WebP failure fallback, badges, touch, returning to an evicted Player after resize, and memory on long sessions.
- [ ] Further image dimensions/srcset or PNG conversion only in another PR if controlled cold/scroll network/transfer/raster and error evidence justifies. Do not alter OG preview cache or share privacy without dedicated security tests.

**Release rules:** keep PERF-06 parent unchecked pending full inventory/real-device proof; retain TEST-04B6.6, TEST-04B and TEST-04 open. No squash merge, database refresh, live provider change or Vercel deploy.
