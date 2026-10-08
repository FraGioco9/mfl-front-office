# ARCH-06 — generated ownership map

**Result: NO CHANGE / no deletion.**

The audited files are generated compatibility projections, not abandoned source.

| Generated output | Canonical owner | Writer |
| --- | --- | --- |
| `index.html` | `html-sources/manifest.json` + HTML fragments | `build-html.mjs` |
| `responsive.css` | `responsive-sources/manifest.json` + `.css.inc` fragments | `build-responsive.mjs` |
| `styles-runtime.css` | canonical CSS graph including generated responsive CSS | `build-styles.mjs` / `style-bundle.mjs` |
| `modules/app-core*-runtime.js` | `modules/core-source-manifest.js` + `modules/core-sources/*` | `build-app-core.mjs` |

These generated files are tracked because CI verifies source/output parity. `public/` and `.next/` are untracked deployment/build projections. `prepare-next-runtime.mjs` copies the required legacy-compatible assets into `public/` for Next without making `public/` a second source tree.

## Removal gate

A generated compatibility artifact may be removed only when all of the following are true:

1. No HTML/bootstrap/config/runtime reference still requests it.
2. The Next projection no longer includes it.
3. Source-owned replacement behavior exists for development, production and deep refresh.
4. `verify:generated` and ownership validators are updated in the same PR.
5. Next dev/prod, browser routing and deep-link regressions prove parity.
6. Rollback documentation identifies the replacement artifact.

Until then, deleting one of these files would remove a required build/deployment edge rather than clean up dead code.

ARCH-06 therefore makes **no deletion and no runtime change**.
