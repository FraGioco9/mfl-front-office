# Source ownership after issue #708

Build with `npm --prefix site run build`. Validate with `npm --prefix site run check`.

- `site/modules/core-sources/shared.js` owns universal state, navigation and synchronous cross-route entry points. Evaluation table rendering, overall controls, render reuse and snapshot hydration belong to `evaluation.js`, loaded by the existing Evaluation route loader. The shared source is 13,547 bytes smaller (3.82%); the behavior is still available on Evaluation routes.
- `site/html-sources/manifest.json` orders the canonical HTML fragments. Edit the route's fragment or `first-paint.html`, never generated `site/index.html`. Fragment boundaries preserve inline script execution order and zero-request first paint. Release/config projections are applied by `normalizeIndexDocument`. The old duplicate Player-shell migration template has been removed from the core compiler.
- `site/responsive-sources/manifest.json` orders canonical responsive fragments by viewport/cascade stage and UI domain. `.css.inc` files are lexical fragments, not standalone stylesheets: media blocks can cross fragment boundaries. Assembly preserves the exact original cascade bytes. New rules belong at the corresponding existing cascade position. `responsive.css` is generated for validation/source composition; production loads it inside the one flattened `styles-runtime.css` bundle, with no extra responsive stylesheet request.
- `site/validation/responsive-*.mjs` owns the existing responsive contracts by UI domain. `validation/assertions.mjs` shares assertion mechanics; `validation-text.mjs` shares normalized cached file reads. The domain runners retain their existing gates and failure messages.
- `scripts/database`, `scripts/marketplace`, and `scripts/email` own operational Python packages. Run entry points from the repository root with `python -m scripts.database.rebuild_database_runner`, `python -m scripts.email.progression_email_preview`, etc. Database/report paths remain rooted at the checkout, not at the relocated module directory.
- `scripts/workflows/*.sh` owns extracted workflow implementation. YAML still owns triggers, permissions, credentials, environment, working directories and artifact boundaries. Database refresh executes helpers from its `builder` checkout, including when operating on the separately checked-out published site. Scripts are invoked with `bash`; no executable-bit dependency is required.
- `tests` owns Python and scheduler regressions. Run `python -m unittest discover -v -p 'test_*.py'` and `node --test tests/*.mjs` from the repository root. Workflow contract tests follow the actual script wired into each step. Additional tests execute local configuration helpers and syntax-check every extracted shell helper without sending email or contacting production.

## Why the TypeScript alias remains

The installed canonical package is `typescript@7.0.2`. Importing it returns version metadata; `createSourceFile` is undefined. The binding validator requires `createSourceFile`, syntax-kind enums and AST predicates. The installed `@typescript/typescript6` package provides those APIs, and the generated-binding regression passes with it. Substituting TypeScript 7 therefore cannot provide equivalent behavior/diagnostics. Retain the alias until the canonical package exposes a compatible compiler API, then compare both validators before removing it.

Reproduce the capability check from `site`:

```sh
node --input-type=module -e 'const native = await import("typescript"); const legacy = (await import("@typescript/typescript6")).default; console.log({nativeVersion: native.version, nativeParser: typeof native.createSourceFile, legacyVersion: legacy.version, legacyParser: typeof legacy.createSourceFile});'
```

Generated runtime files, table-width runtime, deployment config projections, migrations and active dependencies remain tracked. These changes do not run a deployment.
