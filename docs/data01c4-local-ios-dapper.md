# DATA-01C4 — local iPhone/Safari + Dapper QA without Vercel

This procedure prepares the final real-device gate against the **exact local Git checkout**, not the intentionally stale Vercel production deployment.

## Why HTTPS and isolated Supabase are required

The wallet challenge service deliberately accepts HTTP only for loopback origins such as `localhost` and `127.0.0.1`. An iPhone cannot use the PC's loopback address, and weakening that security check for QA would invalidate the test. The launcher therefore uses a temporary HTTPS Quick Tunnel to the local Next server.

A successful Dapper proof exchange creates and later revokes a wallet session through Supabase. To preserve the issue #1034 no-live-write rule, the launcher starts the repository's **local Supabase Docker stack**, resets only that local database, replays local migrations, and overrides any `.env.local` Supabase values in the child process. It never runs `supabase link`, `supabase db push`, `supabase db reset --linked`, or a Vercel command.

Cloudflare Quick Tunnels are intended for testing/development and create a temporary `trycloudflare.com` HTTPS URL. The URL stops working with the `cloudflared` process. Do not reuse it as a deployment.

## Prerequisites on Windows

- current repository checkout on clean `main`;
- Node.js 22.x, npm, Python and Git;
- Docker Desktop (or another Docker-compatible runtime) running;
- `cloudflared` installed and available in `PATH`;
- `api\data-files\mfl_database.db` present;
- iPhone with Safari and the real Dapper account available for the manual portion.

Supabase CLI may be run through `npx`; no remote Supabase login/link is required.

## Start

From the repository root:

```powershell
git switch main
git pull --ff-only
.\scripts\qa\start-data01c4-ios-dapper-local.ps1
```

To reuse existing `node_modules`:

```powershell
.\scripts\qa\start-data01c4-ios-dapper-local.ps1 -SkipInstall
```

An optional Cloudflare email gate can be requested with:

```powershell
.\scripts\qa\start-data01c4-ios-dapper-local.ps1 -AllowedEmail "you@example.com"
```

The script prints the temporary HTTPS **iPhone URL** only after all of these are true:

1. local Supabase is running and current migrations were replayed;
2. the production-mode Next build completed;
3. local `/api/identity.runtime.commit` equals the exact Git HEAD;
4. tunnel `/api/identity.runtime.commit` equals the same Git HEAD;
5. `/api/wallet-session.appIdentifier` equals the temporary HTTPS origin.

The launcher keeps the local server/tunnel alive until Enter is pressed, then stops Next, the tunnel and (by default) the local Supabase stack.

## G01–G09 manual evidence to collect

Keep the protocol in issue #1034 authoritative. During this local session record only observed results:

- **G01:** iPhone Safari cold load, SPA navigation, back/forward/BFCache and orientation.
- **G02/G03:** foreground/resume, identity request behavior and offline/recovery observations.
- **G04:** remains separate unless an authorized SQLite A→B artifact/swap is provided; this launcher does not refresh or replace the database.
- **G05:** Watchlist identity/state across reload/navigation.
- **G06:** dirty Planner state across navigation/foreground; do not lose unsaved edits.
- **G07:** real Dapper Opt In, proof/session establishment, reload restoration, private Settings/Watchlist access, Opt Out/revocation. All persistence in this launcher is local Supabase only.
- **G08:** marketplace/listing UI consistency; external marketplace state is not mutated.
- **G09:** PERF-06.5 / TEST-04B6.6 image scroll/decode and Player→Evaluation checks on real Safari/iPhone.

Do not mark a gate PASS merely because the launcher started. Record PASS only from the actual device/session behavior.

## Security / cleanup

A Quick Tunnel can be reachable from the Internet while active; use it only for the short QA session and optionally use `-AllowedEmail`. Do not paste the local service-role key, wallet challenge secret or browser cookies into issue comments. The script does not print those secrets.

The Dapper wallet signs a real Flow proof, but the application session, opt-in row, preferences and related private state are stored in the **local** Supabase instance started by the launcher. No Vercel deployment or live Supabase write is part of this procedure.
