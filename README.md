# MFL Front Office

Management, scouting, progression, and evaluation tools for MFL.

## Runtime architecture

The MFL player, agent, club, and marketplace dataset is stored in `mfl_database.db`.
Every page, filter, sort, search, summary, and Stats request executes a parameterized SQLite query
through `api/data.js` while the site is running.

The historical full-dataset JSON loader, browser dataset snapshots, download
progress bar, and full-screen page-navigation loading overlay have been removed.
Uncached SQLite requests use only the destination-specific placeholder and wait
cursor; completed route payloads are reused for the current browser session.

Application-core behavior is source-owned under `modules/core-sources/` and
mapped by `modules/core-source-manifest.js`. GitHub Actions generates the
tracked `app-core-*-runtime.js` projections. Only the universal shared core has a
hard size ceiling; route/domain sources are constrained by ownership and lazy
loading rather than arbitrary byte counts.

CSS remains modular in its canonical source files, while `build-styles.mjs`
recursively flattens that dependency graph into the tracked
`styles-runtime.css`. Production therefore serves one primary generated
stylesheet with no nested `@import` requests.

`vercel-config-source.mjs` owns the common Vercel configuration. The build
projects it into the tracked development and production JSON configs, preserving
the production-only immutable cache rule for versioned application-core requests.

Supabase remains responsible for wallet permissions, preferences, watchlists,
notes, saved/shared evaluations, and bug reports because those records are not
part of the MFL SQLite database.

## Local development

Place the database at:

```text
api/data-files/mfl_database.db
```

Prepare the existing database explicitly, then start the canonical root development command:

```powershell
python -m scripts.database.prepare_runtime_database api\data-files\mfl_database.db
npm run dev
```

`npm run dev` is owned by the root `package.json` and starts `local-dev-server.mjs` directly from the repository root on port **4000**. The local server loads the root `.env.local`, serves the SPA, and executes the existing `api/*.js` handlers with the small Vercel-compatible request/response surface they use. Vercel remains the production/deployment runtime and is not involved in local startup. Local startup intentionally does **not** rebuild the database or regenerate tracked site artifacts.

Node.js 22 LTS is required for the site runtime and `node:sqlite`.

For repository checks:

```powershell
npm install
npm run check
```

The check path regenerates canonical Vercel configuration, application-core
artifacts, and the production stylesheet before verifying tracked projections.

## GitHub Actions

The repository currently contains seven workflows:

- **Cleanup unused branches** removes remote branches that do not back an open PR after release metadata reaches `main`.
- **Full database refresh** rebuilds SQLite, sends progression notifications when a valid previous database exists, and publishes/deploys the refreshed database through the protected production path.
- **MFL marketplace snapshot** records scheduled marketplace state used by the application.
- **Progression email Gmail test** sends the explicit Gmail delivery test workflow.
- **Progression email preview** renders and uploads progression-email previews without deploying the site.
- **Site quality** classifies the changed scope, runs the relevant regression/build/lint/typecheck/validation checks, regenerates tracked artifacts once, and publishes a successful `quality` check on the exact generated PR head.
- **Vercel site update** performs the explicit production site update with the latest valid database and regenerated canonical deployment assets.

Generated artifacts have one writer: **Site quality**. Release projection logic is
part of the canonical application-core build, so there is no second projection
workflow racing the generated commit.

## Development ownership

See [source ownership and operational commands](docs/ownership.md) before editing generated assets or running database/email tools. The retained architectural constraints and their rationale are listed in [architectural guardrails](docs/architecture-guardrails.md).
