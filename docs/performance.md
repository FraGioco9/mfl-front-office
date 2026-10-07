# Performance

This document defines the current performance measurement and CI contract for MFL Front Office.

## Stable CI enforcement

Normal Site Quality protects deterministic performance architecture rather than noisy wall-clock thresholds:

- route and payload caches stay bounded and correctly namespaced;
- optional runtimes stay lazy or route-scoped;
- database/query-plan regressions are validated with deterministic fixtures;
- browser regressions protect loading, navigation, responsiveness and request ownership;
- generated assets and runtime boundaries remain validated.

### CI performance enforcement

Do not enforce wall-clock millisecond thresholds in normal Site Quality. Shared CI runners, browser versions,
fixture transfer speed and host contention make those measurements unsuitable as merge gates. Deterministic
architecture and behavioral contracts remain the required CI boundary.

## Opt-in browser baseline

Run the canonical harness with:

```powershell
npm run performance:baseline
```

The baseline is opt-in and must never be described as production latency.

The standard capture uses:

- five repetitions;
- cold navigation;
- refresh;
- cached SPA revisit;
- desktop;
- mobile-slow;
- Server-Timing;
- browser long-task measurements;
- cumulative layout shift.

The harness records the tested source/database/browser context and supports focused journey selection through
its documented environment variables. A manual GitHub Actions workflow is available when a clean runner is
useful.

Performance captures are disposable evidence. Do not commit dated raw captures merely to preserve history;
GitHub Actions artifacts or an external analysis record are sufficient. Commit only code, deterministic
regressions and current operational documentation.

## Interpretation

Synthetic browser numbers are useful for controlled A/B comparisons only when source, dataset, browser,
profile and runner conditions are comparable. They are not production Web Vitals or user-facing latency.

When an experiment does not justify a product change, retain the current implementation and remove the
temporary experiment script/report after the decision is recorded in Git history or the tracking issue.
