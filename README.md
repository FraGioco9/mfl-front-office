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

## One-Time Seasons Population

To populate `age_at_mint` from Flow and calculate `seasons`:

```powershell
python populate_seasons_from_flow.py
```

## Files

- `update_database.py` - main refresh script.
- `populate_seasons_from_flow.py` - one-time Flow helper for seasons.
- `refresh_wallets_only.py` - optional wallet-only refresh helper.
- `mfl_progression.db` - local database, ignored by Git.

## Run Manually From GitHub

After pushing this repository to GitHub, open:

```text
https://github.com/FraGioco9/mfl-progression/actions
```

Choose **Manual database refresh**, click **Run workflow**, fill in the options, then click the green **Run workflow** button.

When the run finishes, open the finished run and download the `mfl_progression_database` artifact. That download contains `mfl_progression.db`.
