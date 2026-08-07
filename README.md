# MFL Front Office

Management, scouting, progression, and evaluation tools for MFL. Player and wallet data are stored in `mfl_database.db` and queried directly with SQLite while the site is running.

## Data architecture

The website does not generate or load player JSON data exports.

- `players` and `wallets` remain the authoritative database tables.
- `site/api/data.js` executes parameterized `SELECT` statements for page rows, filters, sorting, searches, summaries, MFL Stats, and Database Stats.
- `prepare_runtime_database.py` adds query indexes and compact lookup/aggregation tables inside the same SQLite database.
- `site/api/_database.js` opens the bundled database in read-only mode.
- Supabase continues to store wallet permissions, preferences, watchlists, notes, and saved/shared evaluations because those records are not part of `mfl_database.db`.

The API returns JSON over HTTP, but there are no generated `.json` player datasets on disk.

## Rebuild the database

The authenticated rebuild entrypoint is:

```powershell
python run_authenticated_database_rebuild.py
```

Prepare the completed database for website queries:

```powershell
python prepare_runtime_database.py mfl_database.db
```

Both database workflows run the preparation step automatically before uploading the `mfl_database` artifact.

## Run the website locally

Place the database at:

```text
site/api/data-files/mfl_database.db
```

Then run from the repository root:

```powershell
vercel.cmd dev --listen 4000
```

The project requires Node.js 22 because the API uses `node:sqlite`.

## GitHub Actions

- **Full database update** rebuilds and prepares `mfl_database.db`, then uploads the artifact. It does not deploy the website.
- **Vercel site update** downloads the latest database artifact, places the prepared SQLite file behind the API, and deploys the selected site commit.
- **Full database and site update** rebuilds the database and deploys it with the source commit from the latest successful Vercel site update, so a data refresh does not silently change the released site version.

No workflow runs `export_for_website.py`, and no workflow creates or moves player JSON files.

## Vercel project

Use these project settings:

```text
Framework Preset: Other
Root Directory: site
Build Command: leave empty
Output Directory: leave empty
Install Command: leave empty
```

The deployment workflow uses these GitHub Actions secrets:

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

The application also uses the configured Supabase variables for personal and permission-controlled data. Do not commit environment files or credentials.
