# Flow data rebuild

This pipeline rebuilds the existing `players` and `wallets` data without changing the exported player columns.

## Sources and order

1. The global MFL leaderboard is imported first to build the current `wallet_address` to wallet-name map.
2. The MFL players API is then used only for `GET /players?limit=1`, which supplies the inclusive maximum player ID.
3. `MFLPlayer.getPlayerData(id:)` on Flow supplies player metadata in ID batches, beginning at player ID `42`.
4. Current ownership comes from public MFL player collections at one exact sealed Flow block.
5. The existing progressions endpoint supplies `ALL` and `CURRENT_SEASON` progression for players outside the MFL-controlled wallets.
6. Next Overall is calculated with the existing position weights and formulas.

## MFL-controlled wallets

The rebuild treats both of these addresses as MFL-controlled:

- `0xff8d2bbed8164db0` — `MFL`
- `0x6fec8986261ecf49` — `MFL Trade`

Both names are forced into the rebuilt wallet-name map. Players held by either address are excluded from progression API requests, and missing progression fields for either address do not fail validation.

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

1. the forced MFL-controlled wallet name;
2. the name from the newly imported leaderboard;
3. the previous database name, when the leaderboard has no usable name;
4. the wallet address itself.

The rebuilt `wallets` table includes every leaderboard wallet and every resolved current owner.

## Flow metadata concurrency

The supported `run_flow_rebuild.py` entrypoint always requests player IDs from `42` through the inclusive live maximum. Rows below player ID `42` are ignored when reading the previous database snapshot.

Flow metadata uses batches of exactly 3,000 player IDs. This batch size is fixed and is not exposed as a command-line or GitHub Actions option.

Top-level Flow player-ID batches run in parallel with up to 25 worker threads. Each worker preserves recursive batch splitting when a request exceeds Flow computation or storage limits. Completed results are merged on the main thread and returned in player-ID order.

At startup, the rebuild prints the minimum player ID, fixed batch size, parallel-request limit, and the configured MFL-controlled wallets.

## Ownership snapshot

The rebuild scans leaderboard wallets plus distinct owner wallets present in the previous database. Wallets are queried in fixed batches of 100 with up to 25 parallel Flow requests. Each public `MFLPlayer` collection returns its current player IDs through `getIDs()`.

All wallet batches use the same sealed block height, so transfers occurring during the rebuild cannot mix ownership states from different blocks.

The original MFL treasury wallet is handled separately because its collection is too large for one `getIDs()` call and exceeds Flow's 20 MB storage-interaction limit. After normal wallets are resolved, the rebuild checks only unresolved player IDs against that treasury wallet by calling the collection's optional `borrowNFT(id)` method. These checks use fixed batches of 3,000 player IDs, up to 25 parallel requests, and recursive splitting when Flow reports a computation or storage limit.

`MFL Trade` is currently read through its public collection like other normal-sized wallets, while still being treated as MFL-controlled for naming, progression, and validation.

A player found in two wallet collections causes the rebuild to fail. Any player found in neither the scanned collections nor the original MFL treasury also remains unresolved and causes validation to fail.

The validation report records the exact sealed snapshot block, wallet counts, resolved player count, MFL membership candidates, MFL-owned players, unresolved players, and both configured MFL-controlled addresses.

## Progression request policy

The progression client has one process-wide sliding-window limiter:

- at most 80 requests in any 60-second period;
- three retries after the initial request;
- exactly 60 seconds before each retry;
- HTTP 414 requests are split immediately instead of retried.

## Atomic replacement

The previous database is copied to `mfl_progression_candidate.db`. The candidate replaces `mfl_progression.db` only after validation succeeds. The validation report is written to `flow_rebuild_validation.json`.
