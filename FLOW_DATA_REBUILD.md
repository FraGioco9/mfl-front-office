# Flow data rebuild

This pipeline rebuilds the existing `players` and `wallets` data without changing the exported player columns.

## Sources and order

1. The global MFL leaderboard is imported first to build the current `wallet_address` to wallet-name map.
2. The MFL players API is then used only for `GET /players?limit=1`, which supplies the inclusive maximum player ID.
3. `MFLPlayer.getPlayerData(id:)` on Flow supplies player metadata in ID batches.
4. `MFLPlayer.Deposit` events supply the latest wallet owner for every player.
5. The existing progressions endpoint supplies `ALL` and `CURRENT_SEASON` progression for every player outside `0xff8d2bbed8164db0`.
6. Next Overall is calculated with the existing position weights and formulas.

## Preserved columns

The following values are copied unchanged from the previous database because their exact current value cannot yet be derived safely from the confirmed Flow fields:

- `age`
- `retirement_years`
- `owned_since`
- `active_contract_revenue_share`
- `active_contract_club_id`
- `active_contract_club_name`
- `active_contract_club_division`
- `player_seasons`

For a player not present in the previous database, `age` starts from `ageAtMint` and `player_seasons` starts at `1`; the other preserved fields remain `NULL`.

Wallet names use this priority order:

1. the name from the newly imported leaderboard;
2. the previous database name, when the leaderboard has no usable name;
3. the wallet address itself.

The rebuilt `wallets` table includes every leaderboard wallet plus every current Flow owner, including newly discovered owners that are not present in the leaderboard.

## Ownership replay

The first rebuild has no ownership checkpoint, so it replays Flow deposit events from block `0`. The successful ending block is stored in `pipeline_state`. Later incremental runs begin at the following block.

A manual starting height can be supplied while the contract deployment height is being confirmed.

## Progression request policy

The progression client has one process-wide sliding-window limiter:

- at most 80 requests in any 60-second period;
- three retries after the initial request;
- exactly 60 seconds before each retry;
- HTTP 414 requests are split immediately instead of retried.

## Atomic replacement

The previous database is copied to `mfl_progression_candidate.db`. The candidate replaces `mfl_progression.db` only after validation succeeds. The validation report is written to `flow_rebuild_validation.json`.
