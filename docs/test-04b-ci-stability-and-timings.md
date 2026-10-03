# TEST-04B — CI stability and duration triage (3 October 2026)

## Observations and exact evidence

- The repeated Age/Listing 0×0 rectangles at the 1366/1367px boundary occurred on pre-#1100 heads (see TEST-04A and the four source job logs in issue #1034). #1100 introduced a test-only isolation of concurrent NAV-02 page navigation from CDP viewport resizing. Its exact-head [Mobile run 37137411335](https://github.com/FraGioco9/mfl-front-office/actions/runs/37137411335) passed all 8 jobs, including `responsive-table-resize` with **30 viewport snapshots (2×15)** and a controlled hidden-ancestor reproduction. This is **not** proof that no future flake will recur. The post-merge `main` [Site Quality run 37137941454](https://github.com/FraGioco9/mfl-front-office/actions/runs/37137941454) also passed; note that Mobile regression only triggers on PR and manual dispatch, **not** on a `main` push.
- On 1 October [Site Quality run 36911834130](https://github.com/FraGioco9/mfl-front-office/actions/runs/36911834130/attempts/1) failed its Planner `depth-ranking` phase: a free CM/CAM multi-position player was absent from the depth check. The rerun on exactly the same head passed. A specific fixture race was subsequently addressed by [commit 1b4bc90a](https://github.com/FraGioco9/mfl-front-office/commit/1b4bc90a8f38093aefb5e50dec80335072d01cce) on 2 October: the test now waits for the selected club's real roster/aria-busy to settle before installing its synthetic depth roster. Recent focused Planner jobs pass; no further product fix is justified by the available evidence.
- Representative **full-scope successful** Site Quality `quality` job timings read directly from GitHub job-step `started_at`/`completed_at` fields:

| Workflow run | quality job (s) | Browser routing (s) | Planner focused (s) | Notes |
| --- | ---: | ---: | ---: | --- |
| [37135572283](https://github.com/FraGioco9/mfl-front-office/actions/runs/37135572283) | 303 | 213 | 7 | main |
| [37135913376](https://github.com/FraGioco9/mfl-front-office/actions/runs/37135913376) | 300 | 213 | 7 | PR |
| [37136636338](https://github.com/FraGioco9/mfl-front-office/actions/runs/37136636338) | 336 | 218 | 9 | PR |
| [37137165398](https://github.com/FraGioco9/mfl-front-office/actions/runs/37137165398) | 308 | 213 | 7 | main |
| [37137411295](https://github.com/FraGioco9/mfl-front-office/actions/runs/37137411295) | 335 | 218 | 9 | PR |

Scope-aware workflow timings must not be mixed: documentation/partial-quality commits can skip the whole browser test, finishing in single-digit seconds. **The bottleneck is the broad browser routing matrix, not focused Planner.**

- Routing logs for [37137411295](https://github.com/FraGioco9/mfl-front-office/actions/runs/37137411295) show **12 Player scenarios** (default, 1444, 1363, 1200, 1181, 1180, 1101, 1090, 1041, 1040, 980 and 901px) each finish about **16.7 seconds apart** (approximately 200 seconds in all). This is a repeated expensive *test journey*, not independently established application latency.

## Narrow diagnostic PR scope

`validation/browser-routing-responsive-shell.mjs` copies the canonical browser fixture to a temporary path. The TEST-04B change adds guarded, exact-string source instrumentation **only to that temporary copy**, recording per-Player phase durations in the existing browser test `finish("passed", detail)` message as `TEST04B_PHASES`. All original tests, timeouts, screenshot/layout checks, Player scenarios, Chrome flags, routing/navigation behaviors and production files remain unchanged.

The measurements distinguish: first-paint and direct-route checks, delayed Evaluation core readiness, Evaluation controls, transition through Privacy, cached Player return, and final SPA assertions. If source anchors drift, the temporary fixture generator fails explicitly instead of silently dropping the telemetry. This PR does **not** skip any responsive widths, soften failure conditions, move tests into overlapping runners or change DB/production code.

## Follow-up gates

1. CI exact-head must demonstrate 9/9 required workflows with no Planner/resize regression, and the measured Player phase breakdown in logs. No timing optimization without reproducible same-runner A/B and equivalent assertion coverage.
2. Gather subsequent independent Mobile runs *on code including #1100* and corresponding Planner focused runs; a few passing runs are a sample, not a statistical guarantee of flake elimination.
3. Separate optional low-risk performance improvements from TEST-04B evidence; use a dedicated, reviewed PR for each real correction.
4. Keep parent TEST-04 open for ongoing observation, full CI timing triage and final manual Safari/iPhone browser checks. Do not refresh the database, merge this PR or deploy Vercel.
