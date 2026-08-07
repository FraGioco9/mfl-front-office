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

## GitHub Actions

The repository intentionally contains three workflows:

- **Full database update** rebuilds and uploads the SQLite artifact without deploying.
- **Vercel site update** deploys the newest approved site source and latest database.
- **Full database and site update** refreshes SQLite while retaining the source
  commit and displayed version from the latest successful Vercel site update.
