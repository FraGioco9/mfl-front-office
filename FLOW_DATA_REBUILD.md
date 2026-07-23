# Flow data rebuild

This pipeline rebuilds the existing `players` and `wallets` data without changing the exported player columns.

## Sources and order

1. The global MFL leaderboard is imported first to build the current `wallet_address` to wallet-name map.
2. The MFL players API is then used only for `GET /players?limit=1`, which supplies the inclusive maximum player ID.
3. `MFLPlayer.getPlayerData(id:)` on Flow supplies player metadata in ID batches, beginning at player ID `42`.
4. Current ownership comes from public MFL player collections at one exact sealed Flow block.
5. The existing progressions endpoint supplies `ALL` and `CURRENT_SEASON` progression for players outside the MFL-controlled wallets.
6. Next Overall is calculated with the existing position weights and formulas.

## Field sources

Fetched directly from Flow player metadata and written to `players`:

- `player_id`
- `name`
- `positions`
- `nationality` from Flow `nationalities`
- `preferred_foot` from Flow `preferredFoot`
- `height`
- `overall`
- `pace`
- `shooting`
- `passing`
- `dribbling`
- `defense`
- `physical`
- `goalkeeping`

Flow also returns the `season` field in `PlayerData`, but the current rebuild does not write it to a database column.

Fetched from current Flow wallet collections:

- `wallet_address`, or `NULL` when fewer than 50 owners remain unresolved

Fetched or resolved from wallet-name sources:

- `wallet_name`, using forced MFL names, the current leaderboard, the previous database, then the wallet address

Fetched from the MFL progressions API for `ALL` and `CURRENT_SEASON`:

- `overall_prog_all`
- `pace_prog_all`
- `shooting_prog_all`
- `passing_prog_all`
- `dribbling_prog_all`
- `defense_prog_all`
- `physical_prog_all`
- `goalkeeping_prog_all`
- `overall_prog_current_season`
- `pace_prog_current_season`
- `shooting_prog_current_season`
- `passing_prog_current_season`
- `dribbling_prog_current_season`
- `defense_prog_current_season`
- `physical_prog_current_season`
- `goalkeeping_prog_current_season`

Calculated locally rather than fetched:

- `next_overall`
- `next_overall_gap`
- `pace_to_next_overall`
- `shooting_to_next_overall`
- `passing_to_next_overall`
- `dribbling_to_next_overall`
- `defense_to_next_overall`
- `physical_to_next_overall`
- `goalkeeping_to_next_overall`

Copied from the previous database because the rebuild does not currently fetch a reliable live source:

- `age`; for a new player only, it starts from Flow `ageAtMint`
- `retirement_years`
- `owned_since`
- `active_contract_revenue_share`
- `active_contract_club_id`
- `active_contract_club_name`
- `active_contract_club_division`
- `player_seasons`; for a new player only, it starts at `1`

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

The rebuilt `wallets` table includes every leaderboard wallet and every resolved current owner. Players with temporarily unresolved ownership are not added as a wallet row.

## Flow concurrency

The supported `run_flow_rebuild.py` entrypoint always requests player IDs from `42` through the inclusive live maximum. Rows below player ID `42` are ignored when reading the previous database snapshot.

Flow metadata uses batches of exactly 3,000 player IDs. Normal wallet collections use batches of 100 wallets. Original MFL treasury membership uses batches of 3,000 unresolved player IDs.

All three Flow stages use a fixed maximum of 20 parallel requests. Metadata and treasury-membership batches preserve recursive splitting when a request exceeds Flow computation or storage limits.

At startup, the rebuild prints the minimum player ID, fixed batch sizes, and parallel-request limit. It does not print a separate MFL-controlled-wallet notice.

## Ownership snapshot

The rebuild scans leaderboard wallets plus distinct owner wallets present in the previous database. Each public `MFLPlayer` collection returns its current player IDs through `getIDs()`.

All wallet batches use the same sealed block height, so transfers occurring during the rebuild cannot mix ownership states from different blocks.

The original MFL treasury wallet is handled separately because its collection is too large for one `getIDs()` call and exceeds Flow's 20 MB storage-interaction limit. After normal wallets are resolved, the rebuild checks only unresolved player IDs against that treasury wallet by calling the collection's optional `borrowNFT(id)` method.

`MFL Trade` is read through its public collection like other normal-sized wallets, while still being treated as MFL-controlled for naming, progression, and validation.

A player found in two wallet collections causes the rebuild to fail. When fewer than 50 players remain unresolved after all ownership checks, their `wallet_address` is stored as `NULL` and the candidate may still pass validation. At 50 or more unresolved players, the rebuild fails before replacing the players table.

The validation report records the exact sealed snapshot block, wallet counts, resolved player count, MFL membership candidates, MFL-owned players, unresolved player IDs, the ownership failure threshold, and both configured MFL-controlled addresses.

## Progression request policy

The MFL progressions API uses:

- no requests-per-minute limiter or other request-rate cap;
- batches of 1,000 player IDs;
- 100 worker threads for the standard rebuild command;
- three retries after the initial request;
- exactly 61 seconds before each retry;
- retries for HTTP, connection, timeout, invalid-JSON, and invalid-response failures;
- immediate recursive splitting for HTTP 414 responses instead of retrying the oversized request.

Players with `NULL` ownership are included in progression requests because they are not known to belong to either MFL-controlled wallet.

## Atomic replacement

The previous database is copied to `mfl_progression_candidate.db`. The candidate replaces `mfl_progression.db` only after validation succeeds. The validation report is written to `flow_rebuild_validation.json`.
