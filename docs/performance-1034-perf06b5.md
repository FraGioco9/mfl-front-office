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

## Decision and gates

- [ ] Chromium actual Planner with 11 assigned photo elements and 40+ picker candidates passes two modes × two repeats; record ResourceTiming counts and byte samples before/after scroll.
- [ ] Player actual canvas source load, draw, and subsequent warm decode measured in the same isolated fixture; distinguish synthetic BMP from production WebP.
- [ ] Show a same-runner A/B effect **without asserting lower production LCP or memory**; implement a production change in a separate PR only if evidence supports it and safety/fallback tests remain green.
- [ ] Full exact final PR head CI (Site Quality including new test, Windows, Mobile 8/8, Table Header and A11Y-01–06) green and issue #1034 checkboxes updated.
- [ ] **PERF-06.5**, **TEST-04B6.6**, parent **PERF-06** remain open for final real iPhone/Safari QA, real populated profile and production WebP DPR/network/CLS/LCP measurements.

No merge, refresh database or Vercel deploy on this work.
