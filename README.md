# MFL Front Office

Management, scouting, progression, and evaluation tools for MFL.

## Runtime architecture

Player and wallet data are stored only in `mfl_database.db`. Every page, filter,
sort, search, summary, and Stats request executes a parameterized SQLite query
through `site/api/data.js` while the site is running.

The historical full-dataset JSON loader, browser dataset snapshots, download
progress bar, and full-screen page-navigation loading overlay have been removed.
Uncached SQLite requests use only the destination-specific placeholder and wait
cursor; completed route payloads are reused for the current browser session.

Supabase remains responsible for wallet permissions, preferences, watchlists,
notes, and saved/shared evaluations because those records are not part of the
MFL SQLite database.

## Local development

Place the database at:

```text
site/api/data-files/mfl_database.db
```

Prepare it and start Vercel development mode:

```powershell
python prepare_runtime_database.py site\api\data-files\mfl_database.db
vercel.cmd dev --listen 4000
```

Node.js 22 is required for `node:sqlite`.

For lightweight repository checks without browser-test infrastructure:

```powershell
cd site
npm install
npm run check
```

## GitHub Actions

The repository contains three workflows:

- **Full database refresh** rebuilds SQLite, keeps the frontend source from the
  latest successful Vercel site update, and publishes the refreshed database.
- **Vercel site update** deploys the explicitly selected site source with the latest database.
- **Site quality** runs only the relevant lint, typecheck, database-builder smoke,
  and lightweight repository-validation checks for each change.
