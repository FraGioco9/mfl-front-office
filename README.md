# MFL Front Office

Management, scouting, progression, and evaluation tools for MFL.

## Runtime architecture

Player and wallet data are stored only in `mfl_database.db`. Every page, filter,
sort, search, summary, and Stats request executes a parameterized SQLite query
through `site/api/data.js` while the site is running.

The application no longer contains the historical full-dataset JSON loader,
browser data snapshots, download progress bar, or page-navigation loading
overlay. Completed page queries are cached in memory for the current browser
session, so returning to an already loaded view does not repeat the query.

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
python audit_site.py
vercel.cmd dev --listen 4000
```

Node.js 22 is required for `node:sqlite`.

## GitHub Actions

The repository intentionally contains exactly three workflows:

- **Full database update** rebuilds and uploads the SQLite artifact without deploying.
- **Vercel site update** deploys the newest approved site source and latest database.
- **Full database and site update** refreshes SQLite while retaining the source
  commit and displayed version from the latest successful Vercel site update.

All three workflows run `audit_site.py` before rebuilding or deploying.
