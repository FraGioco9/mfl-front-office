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

Next.js owns local development, production builds, routing, cache headers, and Vercel runtime packaging. During the migration, `prepare-next-runtime.mjs` projects the existing generated browser assets into `public/`, while `pages/api/*` forwards to the canonical handlers under `api/`. This keeps current SPA behavior stable while Next becomes the real runtime owner.

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

`npm run dev` follows the same lifecycle as the sibling Next projects: npm runs `predev` once to prepare the temporary compatibility `public/` projection, then `dev` starts `next dev --webpack -p 4000` directly. While the legacy bridge still exists, its projected CSS/JS/HTML assets are explicit Webpack dependencies; changing branches or resetting to a PR resyncs `public/` and triggers Next Fast Refresh/full reload automatically. Next.js serves the existing SPA shell and the `pages/api/*` compatibility routes, while the canonical business logic remains under `api/`. Local development uses Next's supported Webpack mode because the Windows Turbopack/CommonJS path does not currently preserve native `node:sqlite` loading correctly. Root `.env.local` is loaded by Next.js in the same way as the other projects. Local startup intentionally does **not** rebuild the SQLite database or regenerate tracked source artifacts.

Node.js 22 LTS is required for the site runtime and `node:sqlite`.


## Flow account proofs and WalletConnect

Dapper opt-in uses the trusted `WALLET_CHALLENGE_ORIGIN` (the exact browser origin,
including scheme and any local development port) as FCL's account-proof app
identifier. The signed challenge message remains
`MFL Front Office Dapper Opt-In` with the origin, nonce and expiry attached.
Set `WALLET_CHALLENGE_ORIGIN` to the actual site origin in production; local
`http://localhost:4000` is supported by the existing challenge handler.

To support wallets using WalletConnect, [register the app with WalletConnect](https://cloud.walletconnect.com)
and set `WALLETCONNECT_PROJECT_ID` (a 32-character hexadecimal **public
project ID**) in Vercel's Production and Preview environment settings, and
in the root `.env.local` for local testing. Redeploy after changing Vercel
settings. This value is intentionally included in the public wallet-challenge
response so the browser can configure `walletconnect.projectId` before
authenticating with FCL. Do not commit a made-up or borrowed project ID.

Dapper authentication can still work without WalletConnect configuration, but
FCL may warn that some WalletConnect wallets are not available until a real
project ID is supplied.


For a clean dependency install and repository checks:

```powershell
npm ci --no-audit --no-fund
npm run check
```

The check path regenerates canonical HTML/application-core/style artifacts, prepares the Next compatibility `public/` projection, runs a production `next build`, and verifies tracked projections.

## GitHub Actions

The repository currently tracks **26 workflows** under `.github/workflows/`. The exact file-by-file trigger and ownership inventory is maintained in [GitHub Actions workflow inventory](docs/github-actions-workflows.md).

At a high level:

- **Site quality** owns the required `quality` check and is the sole writer of tracked generated application artifacts.
- **A11Y, mobile, table, LOAD and focused security workflows** provide pull-request regressions, with path filters where appropriate.
- **Full database refresh** and the production **Marketplace snapshot** cadence are scheduled by Supabase Cron and reach GitHub through `workflow_dispatch`; they are not GitHub-scheduled production clocks.
- **Operational health monitor** is the production monitor that does use a GitHub `schedule:` trigger, every hour at minutes 07 and 37.
- **Performance baseline, progression-email preview/test and Vercel site update** are explicit/manual operational tools.
- **Actions artifact capacity report** is a monthly/manual read-only storage inventory; **Secret scope presence audit** is a manual presence-only credential-scope check.
- **Cleanup unused branches** is the only workflow with branch-deletion authority and retains its dedicated safeguards.

Generated artifacts have one writer: **Site quality**. Release projection logic is
part of the canonical application-core build, so there is no second projection
workflow racing the generated commit.

## Development ownership

See [source ownership and operational commands](docs/ownership.md) before editing generated assets or running database/email tools. The retained architectural constraints and their rationale are listed in [architectural guardrails](docs/architecture-guardrails.md).
