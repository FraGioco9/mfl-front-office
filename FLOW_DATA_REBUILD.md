# Flow data rebuild

This pipeline builds a validated candidate from the existing `players` and `wallets` data without changing the exported player columns or replacing the active database.

## Sources and order

1. The global MFL leaderboard is imported first to build the current `wallet_address` to wallet-name map.
2. The MFL players API is used only for `GET /players?limit=1`, which supplies the inclusive maximum player ID.
3. `MFLPlayer.getPlayerData(id:)` on Flow supplies player metadata in ID batches, beginning at player ID `42`.
4. Current ownership comes from public MFL player collections at one exact sealed Flow block.
5. The complete available `MFLPlayer.Deposit` event history supplies `owned_since` for every player with a resolved current owner.
6. The existing progressions endpoint supplies `ALL` and `CURRENT_SEASON` progression for players outside the MFL-controlled wallets.
7. Next Overall is calculated with the existing position weights and formulas.

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

Flow also returns `season` and `ageAtMint`. The rebuild uses the highest returned Flow season as `currentSeason`, then calculates:

- `age = ageAtMint + (currentSeason - mintSeason)`
- `player_seasons = currentSeason - mintSeason + 1`

The rebuild fails when `ageAtMint` or `season` is missing, when a mint season exceeds the detected current season, or when either derived column remains missing.

Fetched from current Flow wallet collections:

- `wallet_address`, or `NULL` when fewer than 50 owners remain unresolved

Reconstructed from the complete available Flow `Deposit` history:

- `owned_since`, stored as Unix milliseconds from the block timestamp of the latest deposit whose destination matches the current snapshot owner

The `owned_since` rules are:

- scan from Flow block height `0` through the current sealed snapshot block on every candidate rebuild;
- use the latest deposit for every player, including players whose owner did not change since the previous database;
- overwrite any previous `owned_since` value with the Flow-derived timestamp;
- allow `NULL` only for players whose current owner is unresolved under the existing fewer-than-50 ownership tolerance;
- fail validation when a resolved player has no deposit event, the latest deposit owner differs from the current ownership snapshot, or the event timestamp is invalid;
- fail the rebuild when the historical Flow event endpoint cannot provide the requested history.

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

- `retirement_years`
- `active_contract_revenue_share`
- `active_contract_club_id`
- `active_contract_club_name`
- `active_contract_club_division`

## MFL-controlled wallets

The rebuild treats both of these addresses as MFL-controlled:

- `0xff8d2bbed8164db0` — `MFL`
- `0x6fec8986261ecf49` — `MFL Trade`

Both names are forced into the rebuilt wallet-name map. Players held by either address are excluded from progression API requests, and missing progression fields for either address do not fail validation.

## Preserved columns

The following values are copied unchanged from the previous database:

- `retirement_years`
- `active_contract_revenue_share`
- `active_contract_club_id`
- `active_contract_club_name`
- `active_contract_club_division`

Wallet names use this priority order:

1. the forced MFL-controlled wallet name;
2. the name from the newly imported leaderboard;
3. the previous database name, when the leaderboard has no usable name;
4. the wallet address itself.

The rebuilt `wallets` table includes every leaderboard wallet and every resolved current owner. Players with temporarily unresolved ownership are not added as a wallet row.

## Flow concurrency

The supported `run_flow_rebuild.py` entrypoint always requests player IDs from `42` through the inclusive live maximum. Rows below player ID `42` are ignored when reading the previous database snapshot.

Flow metadata uses batches of exactly 3,000 player IDs. Normal wallet collections use batches of 100 wallets. Original MFL treasury membership uses batches of 3,000 unresolved player IDs.

Metadata, wallet collection, treasury membership, and top-level `owned_since` history windows use a maximum of 20 parallel requests. Metadata and treasury-membership batches preserve recursive splitting when a request exceeds Flow computation or storage limits. Historical event ranges also split recursively when the Flow endpoint rejects a range.

The `owned_since` scan divides the chain into top-level windows of 1,000,000 block heights before any endpoint-driven recursive splitting. Its progress messages show completed windows, newly returned events, and the running event total without printing long block ranges.

At startup, the rebuild prints the minimum player ID, fixed batch sizes, and parallel-request limit. It does not print a separate MFL-controlled-wallet notice.

## Ownership snapshot and owned since

The rebuild scans leaderboard wallets plus distinct owner wallets present in the previous database. Each public `MFLPlayer` collection returns its current player IDs through `getIDs()`.

All wallet batches use the same sealed block height, so transfers occurring during the rebuild cannot mix ownership states from different blocks.

The original MFL treasury wallet is handled separately because its collection is too large for one `getIDs()` call and exceeds Flow's 20 MB storage-interaction limit. After normal wallets are resolved, the rebuild checks only unresolved player IDs against that treasury wallet by calling the collection's optional `borrowNFT(id)` method.

`MFL Trade` is read through its public collection like other normal-sized wallets, while still being treated as MFL-controlled for naming, progression, and validation.

A player found in two wallet collections causes the rebuild to fail. When fewer than 50 players remain unresolved after all ownership checks, their `wallet_address` and `owned_since` are stored as `NULL` and the candidate may still pass validation. At 50 or more unresolved players, the rebuild fails before replacing the players table inside the candidate.

After the sealed ownership snapshot is known, the rebuild scans all available `MFLPlayer.Deposit` events from block height `0` through that sealed block. Events are ordered by block height, transaction index, and event index. The latest event for every player must point to the same wallet as the current ownership snapshot.

The validation report records the exact sealed snapshot block, wallet counts, resolved player count, MFL membership candidates, MFL-owned players, unresolved player IDs, the ownership failure threshold, both configured MFL-controlled addresses, the detected current Flow season, the full `owned_since` event range, event count, populated count, unresolved-owner IDs, missing-event IDs, owner-mismatch IDs, and invalid-timestamp IDs.

A complete live candidate run is required to confirm that the configured Flow endpoint can serve the entire historical event range, including older Flow sporks.

## Progression request policy

The MFL progressions API uses:

- no requests-per-minute limiter or other request-rate cap;
- batches of 1,000 player IDs;
- 100 worker threads for the standard rebuild command;
- three retries after the initial request;
- exactly 70 seconds before each retry;
- retries for HTTP, connection, timeout, invalid-JSON, and invalid-response failures;
- immediate recursive splitting for HTTP 414 responses instead of retrying the oversized request.

Players with `NULL` ownership are included in progression requests because they are not known to belong to either MFL-controlled wallet.

## Completion output

The final duration is displayed in minutes and seconds:

```text
Total time: 42m 7s
```

## Candidate-only output

At the beginning of a run, `mfl_progression.db` is copied to `mfl_progression_candidate.db`. All rebuilding and validation happen only inside the candidate.

After successful validation:

- `mfl_progression_candidate.db` remains available as the result;
- `mfl_progression.db` remains unchanged;
- `flow_rebuild_validation.json` is written beside the databases;
- no automatic promotion or file replacement is performed.

The GitHub candidate workflow restores its input only from active-database workflows, verifies that the active database hash is unchanged after the run, and uploads the candidate under the separate artifact name `mfl_progression_candidate_database`.
