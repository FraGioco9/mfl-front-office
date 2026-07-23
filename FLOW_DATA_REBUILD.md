# Flow data rebuild

This pipeline rebuilds the existing `players` and `wallets` data without changing the exported player columns.

## Sources and order

1. The global MFL leaderboard is imported first to build the current `wallet_address` to wallet-name map.
2. The MFL players API is then used only for `GET /players?limit=1`, which supplies the inclusive maximum player ID.
3. `MFLPlayer.getPlayerData(id:)` on Flow supplies player metadata in ID batches, beginning at player ID `42`.
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

## Flow metadata concurrency

The supported `run_flow_rebuild.py` entrypoint always requests player IDs from `42` through the inclusive live maximum. Rows below player ID `42` are ignored when reading the previous database snapshot.

Flow metadata uses batches of exactly 3,000 player IDs. This batch size is fixed and is not exposed as a command-line or GitHub Actions option.

Top-level Flow player-ID batches run in parallel with up to 25 worker threads. Each worker preserves recursive batch splitting when a request exceeds Flow computation or storage limits. Completed results are merged on the main thread and returned in player-ID order. Ownership event windows remain sequential so their block order stays explicit.

At startup, the rebuild prints the minimum player ID, fixed batch size, and parallel-request limit so the active settings are visible in the logs.

## Ownership replay

The rebuild starts with the previous database's wallet owner for every existing player. It then replays Flow deposit events to apply every ownership change available from the configured access node.

A full replay initially requests block `0`. If the current Flow access node reports that older blocks are below its spork root, the rebuild automatically restarts at the reported spork root. In that case, ownership before the root remains seeded from the previous database, while Flow deposit events are authoritative from the spork root onward.

The fallback does not print a separate informational notice. Before every ownership-event request, including recursively split ranges, the console prints the exact block interval being fetched so an active request does not look stalled.

The validation report records the requested start height, effective start height, reported spork root, and whether this fallback was used. The impossible all-history event-coverage assertion is disabled only for this fallback; ownerless-player and all other validation checks remain active.

The successful ending block is stored in `pipeline_state`. Later incremental runs begin at the following block. A manual starting height can still be supplied when required.

## Progression request policy

The progression client has one process-wide sliding-window limiter:

- at most 80 requests in any 60-second period;
- three retries after the initial request;
- exactly 60 seconds before each retry;
- HTTP 414 requests are split immediately instead of retried.

## Atomic replacement

The previous database is copied to `mfl_progression_candidate.db`. The candidate replaces `mfl_progression.db` only after validation succeeds. The validation report is written to `flow_rebuild_validation.json`.
