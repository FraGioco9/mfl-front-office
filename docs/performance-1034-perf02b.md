# PERF-02B — sticky Name mobile paint trials and paired decision

Issue [#1034](https://github.com/FraGioco9/mfl-front-office/issues/1034), following the [PERF-02A diagnosis](performance-1034-perf02.md). Date: **2026-10-03**.

## Controlled setup

Both experiments compared the exact released-code base `22b2e24905af976c40fa86037c32465d9d1f2c50` against **one CSS change at a time**, using two local production Next servers in the same GitHub Actions job. Each used the same validated SQLite runtime artifact `11242500512` (387,258 rows, 7,866 wallets, dataset `generated_at=2026-10-02T17:17:23.160Z`), one locked `npm ci` install, Next 16.3.6/Node 22.23.3 and Chrome 154.0.8037.57. The `mobile-slow` profile simulated 390×844, CPU ×4 and 150 ms network latency; five pairs were alternated control→candidate and candidate→control. Each run measured cold, refresh, then cached Database/Attributes navigation with 100 rendered rows/1,600 table cells.

This is **synthetic frontend evidence only**, not live production timings, an iPhone/Safari trace or a user percentile. The alternating pairs reduce but do not eliminate runner, cache and warming noise. The actual browser layout/paint breakdown is sampled via Long Animation Frame data, not an exact isolated paint benchmark. Raw JSON/console/server logs are preserved in the original artifacts (GitHub retention 90 days).

## Trial 1: simplify relational selectors — rejected

- Experimental candidate SHA `5f97dea047dafc407bbfb4194b1acae7e6dc6adc`; [same-runner A/B #37113601458](https://github.com/FraGioco9/mfl-front-office/actions/runs/37113601458), [raw artifact #11271101828](https://github.com/FraGioco9/mfl-front-office/actions/runs/37113601458/artifacts/11271101828).
- Replaced the four mobile Name `td:has(> .playerNameCell)` alternatives with `td.col-name` while preserving sticky z-index and body-only separator.
- Cached settled **paired differences (candidate − control)**: **−96.5, −9.3, −8.6, +19.6, +14.6 ms**. Paired median **−8.6 ms**, only 3/5 favorable; the control/candidate median-of-samples values were **438.6 / 407.2 ms**. The latter unpaired difference is not an appropriate causal effect estimate.
- Cached long-task paired median **−10 ms**; cold settled paired median **+22.7 ms**; refresh settled paired median **−11.2 ms**. Cached CLS unchanged (~0.0411).
- **Decision: revert.** The gain is small and inconsistent relative to observed run-to-run variation.

## Trial 2: omit redundant same-color gradients — candidate retained for final CI

- Experimental candidate SHA `aaeb44703aa656af9cee100d55129af1a3cc32e6`; [same-runner A/B #37113860600](https://github.com/FraGioco9/mfl-front-office/actions/runs/37113860600), [raw artifact #11270337325](https://github.com/FraGioco9/mfl-front-office/actions/runs/37113860600/artifacts/11270337325).
- Three solid opaque background colors already provide the correct surface, hovered and loading colors on mobile sticky Name cells. Remove only the three redundant `background-image: linear-gradient(color, color)` layers, leaving original relational selector compatibility, position/inset, sticky separator, background-color/clip, z-index and isolation untouched. Header and nonmobile styles are unchanged.
- Controlled medians and the median of the **within-pair** differences, in milliseconds:

| Phase | Metric | Control median | Candidate median | Median paired Δ | Favorable pairs |
| --- | --- | ---: | ---: | ---: | --- |
| cold | useful content | 2674.2 | 2674.6 | +0.4 | 2/5 |
| cold | settled | 3295.9 | 3301.3 | −8.8 | 3/5 |
| cold | long tasks | 2207 | 2231 | +53 | 2/5 |
| refresh | useful content | 1894.5 | 1856.1 | −40.3 | 5/5 |
| refresh | settled | 1986.6 | 1949.5 | −44.0 | 5/5 |
| refresh | long tasks | 1449 | 1364 | −112 | 5/5 |
| cached | useful content | 38.8 | 39.1 | −0.2 | 3/5 |
| cached | settled | 498.3 | 456.9 | **−38.9** | **5/5** |
| cached | long tasks | 443 | 400 | **−43** | **5/5** |

Cached settled five individual **paired Δ**: **−51.4, −38.9, −28.0, −17.0, −69.0 ms**. Median paired improvement ~7.8% of paired control; refresh settled five paired Δ: **−361.7, −21.3, −44.0, −37.6, −54.4 ms**. Cached CLS remained **0.0411** on both sides in all five pairs; cold/refresh CLS remained ~0. The first refresh pair contained a much larger difference than subsequent pairs, so focus on the paired median and all-pair direction rather than the extreme.

**Decision:** this narrow candidate passes the measured **repeatability** screen: all five cached settled and long-task pairs improved; all five refresh settled pairs also improved, with neutral/mixed cold settlement, and no measured CLS regression. This is supporting evidence, **not proof of production/iPhone performance or pixel-for-pixel identity**. Keep only the narrow CSS change, subject to full branch CI and final manual Safari/touch/hover/first-paint checks.

## Functional/release acceptance

Automated gates must include generated bundle/parity; Table-sticky body-only separator + edge fades at start/middle/end; 100-row mobile horizontal scroll; sorting without navigation; touch/responsive resize; loading Name cells; hover; light/dark contrast and A11Y; Node/Windows Next smoke. The implementation cannot change width owner, data loading, paging, filtering, selection, wallet, API or RLS. Log any intermittent CI separately under TEST-04; do not weaken assertions to obtain a green result.

A final real-device Safari/iPhone touch, keyboard/VoiceOver/NVDA, theme, cache-revisit and filtered/selected table check is deferred to **PERF-02C at the single issue-wide release**. No interim Vercel deploy and no production database change. Temporary branch-only A/B workflow must be removed before merge; the original opt-in baseline tool remains unchanged.
