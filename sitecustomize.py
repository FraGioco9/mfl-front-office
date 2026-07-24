"""Project-wide Python startup overrides for the database rebuild."""

from concurrent.futures import ThreadPoolExecutor, as_completed

import fresh_mfl_database_rebuild as rebuild


# Number of player IDs requested in each Flow metadata batch.
rebuild.FLOW_BATCH_SIZE = 3000

# Number of wallet addresses requested in each Flow wallet-ownership batch.
rebuild.WALLET_BATCH_SIZE = 3000

# Number of players requested in each progression API batch.
rebuild.PROGRESSION_BATCH_SIZE = 1000

# Use the current PlayMFL progression endpoint.
rebuild.PROGRESSIONS_URL = "https://api.playmfl.com/players/progressions"

# Keep progression requests capped at 80 per minute.
rebuild.REQUESTS_PER_MINUTE = 80


_latest_highest_player_id = rebuild.MIN_PLAYER_ID - 1
_original_fetch_leaderboard = rebuild.fetch_leaderboard
_original_build_current_ownership = rebuild.build_current_ownership
_original_log = rebuild.log


def log_without_player_rows(message: str) -> None:
    if message.startswith("Player table row "):
        return
    _original_log(message)


def fetch_leaderboard_with_highest_id():
    global _latest_highest_player_id
    wallet_names, highest_player_id = _original_fetch_leaderboard()
    if highest_player_id is not None:
        _latest_highest_player_id = max(_latest_highest_player_id, highest_player_id)
    return wallet_names, highest_player_id


def build_current_ownership_with_blanks(wallet_players):
    ownership, duplicates = _original_build_current_ownership(wallet_players)
    highest_owned_id = max(ownership, default=rebuild.MIN_PLAYER_ID - 1)
    highest_player_id = max(_latest_highest_player_id, highest_owned_id)

    for player_id in range(rebuild.MIN_PLAYER_ID, highest_player_id + 1):
        ownership.setdefault(player_id, "")

    return ownership, duplicates


def fetch_progressions_without_system_wallets(connection) -> None:
    ids = [
        int(row[0])
        for row in connection.execute(
            """
            SELECT player_id
            FROM players
            WHERE lower(trim(wallet_address)) NOT IN (?, ?)
            ORDER BY player_id
            """,
            (rebuild.MFL_ADDRESS.lower(), rebuild.MFL_TRADE_ADDRESS.lower()),
        )
    ]
    batches = rebuild.chunks(ids, rebuild.PROGRESSION_BATCH_SIZE)
    limiter = rebuild.RateLimiter(rebuild.REQUESTS_PER_MINUTE)
    tasks = [
        (interval, suffix, batch)
        for interval, suffix in (
            ("ALL", "all"),
            ("CURRENT_SEASON", "current_season"),
        )
        for batch in batches
    ]
    completed_count = 0
    processed_players = 0
    total_tasks = len(tasks)

    rebuild.log(
        f"Progression progress 0/{total_tasks}: "
        f"{len(ids)} players, {rebuild.PROGRESSION_BATCH_SIZE} per batch, "
        f"{rebuild.REQUESTS_PER_MINUTE} requests/min"
    )

    with ThreadPoolExecutor(
        max_workers=min(rebuild.PROGRESSION_WORKERS, max(1, total_tasks))
    ) as executor:
        futures = {
            executor.submit(rebuild.progression_request, batch, interval, limiter): (
                interval,
                suffix,
                batch,
            )
            for interval, suffix, batch in tasks
        }
        for future in as_completed(futures):
            interval, suffix, batch = futures[future]
            data = future.result()
            rows = [
                tuple(
                    rebuild.progression_value(data.get(str(player_id)), attribute)
                    for attribute in rebuild.ATTRIBUTES
                )
                + (player_id,)
                for player_id in batch
            ]
            assignments = ", ".join(
                f"{attribute}_prog_{suffix} = ?"
                for attribute in rebuild.ATTRIBUTES
            )
            connection.executemany(
                f"UPDATE players SET {assignments} WHERE player_id = ?",
                rows,
            )
            connection.commit()
            completed_count += 1
            processed_players += len(batch)
            rebuild.log(
                f"Progression progress {completed_count}/{total_tasks}: "
                f"{interval}, {processed_players} total players"
            )


rebuild.log = log_without_player_rows
rebuild.fetch_leaderboard = fetch_leaderboard_with_highest_id
rebuild.build_current_ownership = build_current_ownership_with_blanks
rebuild.fetch_progressions = fetch_progressions_without_system_wallets
