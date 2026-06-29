# MFL Progression Database

Scripts for refreshing MFL wallet, player, and progression data into a local SQLite database.

## Main Command

```powershell
python update_database.py
```

This creates `mfl_progression.db` if it does not exist, refreshes the wallet leaderboard, refreshes players, and refreshes progression data.

## Useful Options

Refresh only the first 10 wallets:

```powershell
python update_database.py --limit 10
```

Refresh one wallet:

```powershell
python update_database.py --wallet 0xded029856b747978
```

Set worker count:

```powershell
python update_database.py --workers 20
```

Populate player seasons from Flow after the normal database refresh:

```powershell
python update_database.py --seasons yes
```

The player seasons step uses the same `--workers` value as the wallet and progression refreshes. It also limits Flow requests so it stays below Flow's 100-per-second limit.

Skip player seasons:

```powershell
python update_database.py --seasons no
```

## Files

- `update_database.py` - main refresh script.
- `populate_seasons_from_flow.py` - one-time Flow helper for player seasons.
- `export_for_website.py` - exports the database into static website data files.
- `site/` - free GitHub Pages table website.
- `refresh_wallets_only.py` - optional wallet-only refresh helper.
- `mfl_progression.db` - local database, ignored by Git.

## Run Manually From GitHub

After pushing this repository to GitHub, open:

```text
https://github.com/FraGioco9/mfl-progression/actions
```

Choose one of the manual workflows:

- **Manual database refresh** refreshes the database only and uploads `mfl_progression_database`.
- **Manual site update** updates only the website using the latest successful database artifact.
- **Manual database and site update** refreshes the database, exports website data, and publishes the website.
- **Manual Vercel site update** updates only the Vercel website using the latest successful database artifact.

When a database run finishes, open the finished run and download the `mfl_progression_database` artifact if you want a copy. That download contains `mfl_progression.db`.

The same run also publishes the website. After GitHub Pages is enabled, open:

```text
https://fragioco9.github.io/mfl-progression/
```

## Vercel Protected Website

Use Vercel if you want a real login in front of the website.

### 1. Create a Vercel account

Create an account at:

```text
https://vercel.com
```

The free account is enough to start.

### 2. Create the Vercel project

In Vercel, create a new project from this GitHub repository:

```text
FraGioco9/mfl-progression
```

Use these project settings:

```text
Framework Preset: Other
Root Directory: site
Build Command: leave empty
Output Directory: leave empty
Install Command: leave empty
```

Deploy once from Vercel so the project exists.

### 3. Create a Vercel token

In Vercel, open:

```text
Account Settings -> Tokens
```

Create a token and copy it.

### 4. Add GitHub secrets

In GitHub, open:

```text
Repository -> Settings -> Secrets and variables -> Actions -> New repository secret
```

Add these three secrets:

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

To find `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`, open the Vercel project, then go to:

```text
Project Settings -> General
```

They are shown as the Team ID / Org ID and Project ID.

### 5. Enable login protection

In Vercel, open the project settings and enable Deployment Protection / Vercel Authentication for the production deployment.

After this is enabled, visitors must log in through Vercel before they can see the website or download the data files.

### 6. Publish to Vercel

In GitHub Actions, run:

```text
Manual Vercel site update
```

This downloads the latest database artifact, exports the website data, and deploys the protected site to Vercel.

If you do not want the public GitHub Pages version anymore, disable GitHub Pages in:

```text
Repository -> Settings -> Pages
```
