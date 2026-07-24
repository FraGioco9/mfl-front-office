# Flow data rebuild

This pipeline builds and validates `mfl_progression_candidate.db` while leaving the active `mfl_progression.db` unchanged.

## Sources and order

1. Import the global MFL leaderboard for wallet names.
2. Use `GET /players?limit=1` only to discover the inclusive maximum player ID.
3. Read `MFLPlayer.getPlayerData(id:)` from Flow in ID batches beginning at player ID `42`.
4. Resolve current ownership from public Flow collections at one sealed block.
5. Reconstruct `owned_since` from the complete available `MFLPlayer.Deposit` history.
6. Refresh `ALL` and `CURRENT_SEASON` progression from the MFL progression endpoint.
7. Recalculate Next Overall fields locally.

## Fields fetched from Flow player metadata

The following columns are refreshed from `MFLPlayer.PlayerData` on every rebuild:

- `player_id`
- `name`
- `positions`
- `age`, calculated from metadata `ageAtMint` and `PlayerData.season`
- `nationality` from metadata `nationalities`
- `preferred_foot` from metadata `preferredFoot`
- `height`
- `overall`
- `pace`
- `shooting`
- `passing`
- `dribbling`
- `defense`
- `physical`
- `goalkeeping`
- `player_seasons` from `PlayerData.season`

The formulas are:

```text
age = Flow metadata ageAtMint + Flow PlayerData.season - 1
player_seasons = Flow PlayerData.season
```

For example, when player `59073` has `ageAtMint = 19` and `season = 15`, the rebuilt row stores:

```text
age = 19 + 15 - 1 = 33
player_seasons = 15
```

Previous database values do not override either field. The rebuild fails when `ageAtMint` or `season` is missing, invalid, zero, or negative.

## Ownership fields

Fetched from current Flow wallet collections:

- `wallet_address`, or `NULL` for fewer than 50 tolerated unresolved owners

Resolved from wallet-name sources:

- `wallet_name`, using forced MFL names, the current leaderboard, the previous database, then the wallet address

Reconstructed from Flow events:

- `owned_since`, stored as Unix milliseconds from the latest `MFLPlayer.Deposit` block timestamp whose destination matches the current snapshot owner

The owned-since scan starts at Flow block height `0` and ends at the current sealed ownership block. It covers unchanged owners too. A resolved player with no matching deposit, a mismatching latest deposit owner, or an invalid timestamp fails validation.

## Progression fields fetched from the MFL API

All-time:

- `overall_prog_all`
- `pace_prog_all`
- `shooting_prog_all`
- `passing_prog_all`
- `dribbling_prog_all`
- `defense_prog_all`
- `physical_prog_all`
- `goalkeeping_prog_all`

Current season:

- `overall_prog_current_season`
- `pace_prog_current_season`
- `shooting_prog_current_season`
- `passing_prog_current_season`
- `dribbling_prog_current_season`
- `defense_prog_current_season`
- `physical_prog_current_season`
- `goalkeeping_prog_current_season`

Players in the MFL and MFL Trade wallets are excluded from progression requests. Players with unresolved ownership remain included.

## Calculated locally

- `next_overall`
- `next_overall_gap`
- `pace_to_next_overall`
- `shooting_to_next_overall`
- `passing_to_next_overall`
- `dribbling_to_next_overall`
- `defense_to_next_overall`
- `physical_to_next_overall`
- `goalkeeping_to_next_overall`

## Still preserved from the active database

These fields do not currently have a reliable live source in the rebuild:

- `retirement_years`
- `active_contract_revenue_share`
- `active_contract_club_id`
- `active_contract_club_name`
- `active_contract_club_division`

## Concurrency and retries

- Flow metadata: fixed 3,000-ID batches, up to 20 workers
- Normal wallet collections: 100-wallet batches, up to 20 workers
- MFL treasury membership: 3,000-ID batches, up to 20 workers
- Full owned-since history: 1,000,000-block top-level windows, up to 20 workers, with recursive range splitting
- Progression: 1,000-ID batches, 100 workers, three retries after the initial request, 70 seconds before each retry

## Validation and output

Validation records the Flow age formula, season source and distribution, ownership coverage, the complete owned-since event range and errors, progression completeness, and Next Overall completion.

The final duration uses minutes and seconds:

```text
Total time: 42m 7s
```

After successful validation:

- `mfl_progression_candidate.db` contains the rebuilt result;
- `mfl_progression.db` remains byte-for-byte unchanged;
- `flow_rebuild_validation.json` contains the validation report;
- the GitHub workflow uploads the candidate as `mfl_progression_candidate_database`.
