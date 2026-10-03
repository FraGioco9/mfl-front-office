# PERF-06B5 — Populated Planner photo lazy/eager A/B and Player canvas decode

## Isolated source and authorization

Source baseline: main after merged [PERF-06A #1105](https://github.com/FraGioco9/mfl-front-office/pull/1105), SHA `3f5204515c4e5d51ac278f6bbee13bb5527290b4`. Do not require a real account, opt-in state, shared database or user data. `validation/browser-perf06b5-image-ab.mjs` patches a **temporary copy** of the existing `validation/browser-routing-regression.mjs` fixture (synthetic wallet and club #9001). There are no changes to application files, auth logic or the canonical fixture. The existing test server supplies fake players and an opt-in proof only within localhost Chromium.

The fixture uses actual Planner production `formationPreview.setRoster`, `render`, `Auto-fill`, and `#plannerDepthPicker` creation. It fills 11 lineup positions plus 50 competing CBs; tests scroll of the real photo-picker list.

Each source photo `https://d13e14gtps4iwl.cloudfront.net/players/v2/{id}/photo.webp` is **intercepted before a request can be sent** and rewritten in the isolated document to `/__perf06b5/media/{id}.bmp`. The local fixture serves deterministic 72×96 uncompressed raster BMPs. CDP blocks external HTTPS destinations. **No production CDN/media, Supabase, Neon or live database is contacted by this test**. Bitmap size and absolute decode times are deliberately artificial: they support a controlled comparison of request and lazy/eager loading behavior, **not** production WebP bandwidth, LCP or iOS Safari decode.

## Same-runner controlled experiment

Run two repetitions for each mode, using a fresh Chromium process each time (390 CSS px wide, local media), preserving all app code:

- **A lazy-production**: actual `img.loading="lazy"` assigned by the Planner pitch and picker code.
- **B eager-control**: a **test-only override** maps the browser's `loading="lazy"` assignments to `eager`, without editing Planner or its markup in the repository.

After synthetic XI Auto-fill record media ResourceTiming request count/transferSize; open the populated CB picker with 40+ photo rows; sample again before and after scrolling its real `plannerDepthPickerContent`. Report first-viewport request/transfer difference, after-scroll additional photo requests and the 12 visible rows' *post-load* `img.decode()` duration.

For **Player canvas**, use the same original `new Image()` source that the genuine `drawPortraitCrop` calls `drawImage` against: the temp fixture instruments that source's load event and the canvas `drawImage` duration/count. The explicit `source.decode()` is sampled only **after the source has loaded and been drawn**; it is not a measurement of initial decode critical path or LCP.

## Measured Chromium A/B (3 October 2026)

[Site Quality #37147722646](https://github.com/FraGioco9/mfl-front-office/actions/runs/37147722646), exact tested source head `d44f50af10ec40b6ad07ff9755f062425e6ce5be`: **`PERF06B5_AB_PASS`**, two repeats of each mode in the same GitHub CI runner. The first instrumentation iterations incorrectly shared `lazy-production` in both branches or measured a popup that had already closed; those earlier green/failing attempts are **excluded**. This final fixture changes the mode for each browser subprocess and moves the **actual production-created `.plannerDepthPickerContent` DOM node** into a test-only fixed scroll host before Planner's async fixture update can close the popup. This is not the natural lifetime/scroll container of a signed-in production Planner, so the measured benefit is a *controlled image-loading experiment*, not a claim about end-user scroll or network bytes.

The test used a 61-person synthetic roster (11 starters + 50 CBs), 11 actual Player-photo pitch DOM elements, 51 actual Picker-photo DOM elements, and 2373px of controlled scroll range. Photo URLs are replaced with locally generated 72×96 BMP rasters **before any real CloudFront request**; HTTPS is blocked. Every sample measured identical numbers across the two repetitions for each mode:

| Media, per isolated browser fixture | Lazy (production attribute) | Eager (test-only override) |
| --- | ---: | ---: |
| ResourceTiming image requests after pitch Auto-fill | 11 | 11 |
| Requests after picker contents became scrollable, before scroll | **38** | **61** |
| Bytes before scroll | **801,420 B** | **1,286,490 B** |
| Additional image requests/bytes after scrolling to end | **23 / 485,070 B** | **0 / 0 B** |
| Total requests/bytes after scroll | 61 / 1,286,490 B | 61 / 1,286,490 B |
| Visible photos explicitly decoded after load | 6 | 6 |

The current lazy behavior postpones **23 media requests / 485,070 synthetic BMP bytes**, **37.70%** of this test fixture's eager pre-scroll bytes, while fetching the remaining images on scroll. Lazy does not reduce total bytes if the user visits every row. This does **not** mean actual WebP images are 485KB larger, or that production LCP improves by any specified percentage. It does mean there is **no evidence to change the existing Planner lazy property**. No application-code PR has been created.

The actual off-DOM `new Image()` source used by the Player canvas was observed to load one local synthetic BMP (ResourceTiming: **21,090 transfer bytes**), draw **7–9 times** in the canonical Player route and accept `source.decode()` after load. The two lazy-mode samples gave ~82.6ms and 21.2ms from setting source to the `load` event, and 10ms and 0.3ms for a *warm* `decode()` call after render; the values vary substantially, do **not** isolate initial decode vs transport, and are not production WebP LCP. Player canvas raster dimensions in this fixture were 175×96.

**Decision:** keep current Player WebP priority and Planner `loading=lazy`. Only a real populated-account snapshot, CDN WebP decode, memory and LCP/CLS measurement (with explicit authorization, if needed) could justify more. No shared database refresh, Vercel deploy or production auth changes.

## Decision and gates

- [x] Chromium synthetic Planner with 11 pitch and 51 picker photo elements **passes two modes × two repeats**; [Site Quality #37147722646](https://github.com/FraGioco9/mfl-front-office/actions/runs/37147722646). The real production-created picker content was moved to a temporary scroll host; this is **not** normal signed-in popup behavior.
- [x] Actual Player canvas off-DOM source load, draw and subsequent warm decode observed on the *synthetic BMP*. Its variable numbers do not measure production WebP decode/LCP.
- [x] Same-runner controlled lazy vs eager A/B shows 23 fewer initial requests and 485,070 fewer **test BMP** bytes, deferred until scroll. **Existing production lazy is already justified; no product modification proposed.**
- [ ] Full exact final PR head CI (Site Quality including new test, Windows, Mobile 8/8, Table Header and A11Y-01–06) green and issue #1034 checkboxes updated.
- [ ] **PERF-06.5**, **TEST-04B6.6**, parent **PERF-06** remain open for final real iPhone/Safari QA, real populated profile and production WebP DPR/network/CLS/LCP measurements.

No merge, refresh database or Vercel deploy on this work.
