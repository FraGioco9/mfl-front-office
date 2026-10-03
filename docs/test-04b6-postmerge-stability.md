# TEST-04B6 — Post-merge CI stability and Safari/iPhone release gate

**Repository:** `FraGioco9/mfl-front-office`  
**Audit issue:** [#1034](https://github.com/FraGioco9/mfl-front-office/issues/1034)  
**Production-fix PR:** [#1103](https://github.com/FraGioco9/mfl-front-office/pull/1103), squash-merged as [`652fe813`](https://github.com/FraGioco9/mfl-front-office/commit/652fe81359290b8606ed62b73eb5f848aa35a59a) on 3 October 2026  
**Scope:** evidence and a **documentation-only PR based on that exact main commit**, so the ordinary `pull_request` trigger can run all eight Mobile jobs on the *same application source* as merged #1103. This PR intentionally changes no CSS, JavaScript, SQL, UI, API, test assertion or workflow.

## First post-merge main checks

[Site Quality #37140478808](https://github.com/FraGioco9/mfl-front-office/actions/runs/37140478808) is a **completed/success** push run on exact `main` SHA `652fe81359290b8606ed62b73eb5f848aa35a59a`. Both jobs (`quality`, `windows-next-dev-smoke`) succeeded. In the canonical full-scope `quality` job, the browser routing matrix (including Player and NAV-02) passed **39 seconds**, the genuine `mfl:evaluation-rate-settled` regression passed in **2 seconds** with `durationMs:175`, `eventCount:1`, `rateSettled:true` and `rateSource:"supabase-live-request"`, and focused Planner passed **8 seconds** including `depth-ranking`. Complete job elapsed **135 seconds**.

| Comparable full-scope sample | Quality job | Browser routing | Planner | Genuine Evaluation event regression |
| --- | ---: | ---: | ---: | ---: |
| [pre-fix main #37137941454](https://github.com/FraGioco9/mfl-front-office/actions/runs/37137941454), `4d487679` | 328s | 218s | 8s | Not yet added |
| [fix PR #37139698748](https://github.com/FraGioco9/mfl-front-office/actions/runs/37139698748), source head | 147s | 39s | 8s | Pass (2s) |
| [fix PR exact generated head #37139900550](https://github.com/FraGioco9/mfl-front-office/actions/runs/37139900550), `ac0aff89` | 147s | 38s | 9s | Pass (2s) |
| [post-merge main #37140478808](https://github.com/FraGioco9/mfl-front-office/actions/runs/37140478808), `652fe813` | 135s | 39s | 8s | Pass (2s) |

The pre-fix to post-merge reduction on these comparable CI samples is **179 seconds for broad browser routing** and **193 seconds for the overall quality job**. The values are GitHub Actions step/job wall times (rounded seconds), not device load times or guarantees about live services.

The Site Quality workflow's browser regression has the same canonical Player suite; its log contains passing `planner-depth-ranking`, `planner-depth-picker`, `planner-squad` cases and the focused Planner test's `depth-ranking` phase. Historical Planner flake [attempt 1 of run #36911834130](https://github.com/FraGioco9/mfl-front-office/actions/runs/36911834130/attempts/1) was already fixed at `1b4bc90a`.

### Why this documentation-only branch is necessary

`.github/workflows/mobile-first-paint-regression.yml` triggers on `pull_request` and `workflow_dispatch`, **not on push to main**. Re-running a historical job from #1103 after the PR branch has been deleted can fail during `actions/checkout`, without executing a browser test. This PR gives CI a valid branch that starts from the **exact post-merge main code**, without changes to application sources, and runs Mobile's dedicated `responsive-table-resize` regression.

- [x] Initial Mobile **8/8** job success on [run #37140770453](https://github.com/FraGioco9/mfl-front-office/actions/runs/37140770453), including `responsive-table-resize` (job [111254564812](https://github.com/FraGioco9/mfl-front-office/actions/jobs/111254564812)) and `responsive-shell-breakpoint`. All tests ran on the branch whose only diff from the merged app is this documentation file.
- [x] Independent `responsive-table-resize` rerun on **exact unchanged head** `2ed46b5b87f783a7365e9ec8e6d4e0541aae90d5`: [Mobile run #37140770453 attempt 2](https://github.com/FraGioco9/mfl-front-office/actions/runs/37140770453/attempts/2), job [111254891290](https://github.com/FraGioco9/mfl-front-office/actions/jobs/111254891290), **success**.
- [x] `responsive-table-resize` passed its existing Age/Listing assertions and both complete 15-viewport sequences in the first and repeat runs, including 1366/1367px, without an icon-zero failure. Passing CI samples do **not** prove that an intermittent failure can never recur.
- [x] Independent [Site Quality main run #37140478808 attempt 2](https://github.com/FraGioco9/mfl-front-office/actions/runs/37140478808/attempts/2), job [111254351359](https://github.com/FraGioco9/mfl-front-office/actions/jobs/111254351359), success on unchanged `652fe81359290b8606ed62b73eb5f848aa35a59a`: quality **113s**, canonical browser routing **34s** with 55 pass log entries (13 Player), focused Planner **8s** (shell/squad/depth-picker/depth-ranking all passed), actual Evaluation event **175ms** with eventCount=1, rateSettled=true and the same rate source.
- [x] First and repeated targeted post-merge CI showed **no observed regressions**. The documentation-only PR's Site Quality `quality` job is scope-filtered (~6s and skips its routing/Planner browser steps); **do not count that run as full browser quality coverage**. The two **main** runs above supply that independent full-scope coverage. No original assertions, CSS, APIs or app code were changed.

### Status after independent post-merge rechecks (3 October 2026)

The source `main` has stayed at `652fe81359290b8606ed62b73eb5f848aa35a59a` throughout these checks. Post-merge full-scope Site Quality completed twice on that SHA:

| Source/main workflow | Attempt | Quality wall time | Browser routing | Focused Planner | Event |
| --- | --- | ---: | ---: | ---: | --- |
| [#37140478808](https://github.com/FraGioco9/mfl-front-office/actions/runs/37140478808) | 1 | 135s | 39s | 8s | genuine Evaluation ready: 175ms |
| [#37140478808](https://github.com/FraGioco9/mfl-front-office/actions/runs/37140478808/attempts/2) | 2 | 113s | 34s | 8s | genuine Evaluation ready: 175ms |

The independent Mobile PR workflow [#37140770453](https://github.com/FraGioco9/mfl-front-office/actions/runs/37140770453) passed **8/8** jobs, and the isolated `responsive-table-resize` job passed again on attempt 2. Only the documentation file changed relative to merged #1103, so this is post-merge **application-source** coverage, not a published Safari test. All ten manual-device checks remain **unchecked**.

## Manual Safari/iPhone validation — explicitly deferred until final release testing

**These are NOT certified by Chromium CI. Keep all items pending until a person tests a real device/browser on the final application build**, then record date, device model, iOS/macOS version, Safari build, display zoom, orientation and exact build commit. A screenshot or short recording is useful for any unexpected clipping or missing marker.

- [ ] **M1 — iPhone Safari first paint:** load Database directly and via SPA navigation, with and without cached prior visit; no initial hidden content, layout shifts or stray skeleton after data arrives.
- [ ] **M2 — Narrow portrait:** test available real device widths, ideally around 320/360/375/390/430 CSS px (do not claim unsupported exact hardware widths). Confirm table header, sticky Name, column alignment, Age retirement/new-mint marker and Listing icon/price are visible where expected; no zero-width icon rectangles when route is visible.
- [ ] **M3 — Horizontal scroll and taps:** long table scroll (left/right + vertical), row highlight, sort, selection and pagination; sticky Name and cell hitboxes must stay aligned without browser pinch-zoom artifacts.
- [ ] **M4 — Orientation and viewport:** rotate iPhone portrait ↔ landscape and visit directly; no clipped columns, unseen selection controls, stuck overlays or phantom scroll offsets; check safe-area insets.
- [ ] **M5 — Route return and state:** Database → Player → Evaluation → Back → Database; Safari history/back-forward, cached return, loading/skeletons, retained table filters and scroll behavior.
- [ ] **M6 — Evaluation readiness with real app data:** from a Player profile navigate to Evaluation, verify loading indicator eventually clears, authentic Discount Rate displays only after successful server response and dependent values are not spuriously zero or stale. Record backend availability separately from frontend events; do not weaken 15s safety timeout.
- [ ] **M7 — Planner on real Safari:** open Planner, switch Depth formations, place/remove multi-position players, verify depth badges and tap targets, back/forward and orientation. Confirm no stale synthetic roster or wrong ranking (the synthetic fixture is CI-only).
- [ ] **M8 — Accessibility/appearance:** light/dark, larger text where available, touch target sizes, VoiceOver focus/labels and reduced-motion preference. Check visible text and icons do not disappear with dynamic type or browser toolbar movement.
- [ ] **M9 — Desktop Safari responsive breakpoint:** where possible test 1366 and 1367 CSS px at 100% zoom on desktop Safari, since these *desktop breakpoint* values are not iPhone widths. Check Age/Listing box geometry and Name abbreviation on each side.
- [ ] **M10 — Final acceptance:** no active flaky regressions on exact final release head, monitor ongoing CI for new failures, and validate the final deployed build only at the issue's authorized release/deployment gate.

**Not authorized here:** merge this documentation PR, refresh database, adjust live Supabase/Vercel/Railway settings, publish a deployment, or mark the parent TEST-04B/TEST-04 as complete.
