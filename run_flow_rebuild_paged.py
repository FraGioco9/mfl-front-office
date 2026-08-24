from __future__ import annotations

import sqlite3
import threading
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import run_flow_rebuild as pipeline


PLAYMFL_API_BASE_URL = "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod"
pipeline.PLAYERS_URL = f"{PLAYMFL_API_BASE_URL}/players"
pipeline.PROGRESSIONS_URL = f"{PLAYMFL_API_BASE_URL}/players/progressions"
pipeline.flow_module.PLAYERS_URL = pipeline.PLAYERS_URL
pipeline.flow_module._impl.PLAYERS_URL = pipeline.PLAYERS_URL

FIRST_PLAYER_ID = 42
PROGRESSION_MAX_URL_LENGTH = 5000
PREVIOUS_DATABASE_PATH = Path("previous-database/mfl_database.db")
ALL_PROGRESSION_COLUMNS = tuple(
    f"{attribute}_prog_all" for attribute in pipeline.ATTRIBUTES
)
PLAYER_BATCH_ANCHORS: list[int] | None = None
ACTIVE_PROGRESSION_BATCHES: tuple[tuple[int, ...], ...] | None = None
RETIRED_PROGRESSION_BATCHES: tuple[tuple[int, ...], ...] | None = None


class RollingRateLimiter:
    """Allow an immediate burst, then limit starts in a rolling 60-second window."""

    def __init__(self, requests_per_minute: int) -> None:
        self.requests_per_minute = requests_per_minute
        self.window_seconds = 60.0
        self.starts: deque[float] = deque()
        self.lock = threading.Lock()

    def wait(self) -> None:
        while True:
            with self.lock:
                now = time.monotonic()
                cutoff = now - self.window_seconds
                while self.starts and self.starts[0] <= cutoff:
                    self.starts.popleft()

                if len(self.starts) < self.requests_per_minute:
                    self.starts.append(now)
                    return

                delay = max(0.001, self.starts[0] + self.window_seconds - now)

            time.sleep(delay)


def discover_player_batch_anchors(limiter: RollingRateLimiter) -> list[int]:
    """Pre-determine fixed 1500-ID API page boundaries through player ID 42."""
    page = pipeline.fetch_players_page(
        limiter,
        page_label="Highest player ID batch",
    )
    ids = sorted({pipeline.player_id(player) for player in page}, reverse=True)
    if not ids:
        raise RuntimeError("Highest player ID batch was empty")

    highest_player_id = ids[0]
    if highest_player_id < FIRST_PLAYER_ID:
        raise RuntimeError(
            f"Highest PlayMFL player ID {highest_player_id} is below "
            f"the required first ID {FIRST_PLAYER_ID}"
        )

    player_id_span = highest_player_id - FIRST_PLAYER_ID + 1
    total_batches = (
        player_id_span + pipeline.MFL_PAGE_SIZE - 1
    ) // pipeline.MFL_PAGE_SIZE
    anchors = [
        highest_player_id - batch_index * pipeline.MFL_PAGE_SIZE + 1
        for batch_index in range(1, total_batches)
    ]

    pipeline.log(f"Highest PlayMFL player ID: {highest_player_id}")
    pipeline.log(
        f"Player ID batches ready: {total_batches} predetermined batches of up to "
        f"{pipeline.MFL_PAGE_SIZE}, covering IDs {highest_player_id}-{FIRST_PLAYER_ID}"
    )
    return anchors


def refresh_wallets_without_playmfl_limiter(
    connection: Any,
    limiter: RollingRateLimiter,
) -> int:
    """Save leaderboard wallets, then build the PlayMFL player batch plan."""
    data = pipeline.request_json(pipeline.LEADERBOARD_URL, "Leaderboard")
    users = data.get("users") if isinstance(data, dict) else None
    if not isinstance(users, list):
        raise RuntimeError("Leaderboard response did not contain a users list")

    wallets: dict[str, str] = {}
    for user in users:
        if not isinstance(user, dict):
            continue
        address = str(user.get("walletAddress") or "").strip().lower()
        if address:
            wallets[address] = str(user.get("name") or "")

    wallets[pipeline.MFL_WALLET_ADDRESS] = pipeline.MFL_WALLET_NAME
    wallets[pipeline.MFL_TRADE_WALLET_ADDRESS] = pipeline.MFL_TRADE_WALLET_NAME
    connection.executemany(
        "INSERT INTO wallets(wallet_address, name) VALUES (?, ?)",
        sorted(wallets.items()),
    )
    connection.commit()
    pipeline.log(f"Wallets saved: {len(wallets)}")

    global PLAYER_BATCH_ANCHORS
    PLAYER_BATCH_ANCHORS = discover_player_batch_anchors(limiter)
    return len(wallets)


def fetch_predetermined_player_source(
    limiter: RollingRateLimiter,
    *,
    label: str,
    anchors: list[int],
    retired: bool | None = None,
    wallet_address: str | None = None,
) -> list[dict[str, Any]]:
    """Fetch one source concurrently using API-derived batch anchors."""
    first_page = pipeline.fetch_players_page(
        limiter,
        page_label=f"{label} initial batch",
        retired=retired,
        wallet_address=wallet_address,
    )
    players: dict[int, dict[str, Any]] = {
        pipeline.player_id(player): player for player in first_page
    }
    total_batches = 1 + len(anchors)
    completed_batches = 1
    pipeline.log(
        f"{label} batch {completed_batches}/{total_batches}: "
        f"returned {len(first_page)}, total {len(players)}"
    )

    if not anchors:
        return list(players.values())

    with ThreadPoolExecutor(
        max_workers=min(pipeline.MFL_WORKERS, len(anchors))
    ) as executor:
        futures = {
            executor.submit(
                pipeline.fetch_players_page,
                limiter,
                page_label=f"{label} queued batch",
                before_player_id=before_player_id,
                retired=retired,
                wallet_address=wallet_address,
            ): before_player_id
            for before_player_id in anchors
        }

        for future in as_completed(futures):
            page = future.result()
            players.update({pipeline.player_id(player): player for player in page})
            completed_batches += 1
            pipeline.log(
                f"{label} batch {completed_batches}/{total_batches}: "
                f"returned {len(page)}, total {len(players)}"
            )

    return list(players.values())


def fetch_all_player_sources(
    limiter: RollingRateLimiter,
) -> dict[str, list[dict[str, Any]]]:
    if PLAYER_BATCH_ANCHORS is None:
        raise RuntimeError("Player ID batches were not prepared before player loading")
    anchors = list(PLAYER_BATCH_ANCHORS)

    pipeline.log(
        "API-derived PlayMFL batches: "
        f"active {1 + len(anchors)}, "
        f"retired {1 + len(anchors)}, "
        f"MFL {1 + len(anchors)}, "
        f"MFL Trade {1 + len(anchors)}"
    )

    jobs = {
        "general": {
            "label": "Active players",
            "anchors": anchors,
            "retired": False,
        },
        "retired": {
            "label": "Retired players",
            "anchors": anchors,
            "retired": True,
        },
        "mfl": {
            "label": "MFL wallet",
            "anchors": anchors,
            "wallet_address": pipeline.MFL_WALLET_ADDRESS,
        },
        "mfl_trade": {
            "label": "MFL Trade wallet",
            "anchors": anchors,
            "wallet_address": pipeline.MFL_TRADE_WALLET_ADDRESS,
        },
    }

    results: dict[str, list[dict[str, Any]]] = {}
    with ThreadPoolExecutor(max_workers=len(jobs)) as executor:
        futures = {
            executor.submit(fetch_predetermined_player_source, limiter, **config): key
            for key, config in jobs.items()
        }
        for future in as_completed(futures):
            results[futures[future]] = future.result()

    return results


def _owner_wallet_address(player: dict[str, Any]) -> str:
    owner = player.get("ownedBy")
    if not isinstance(owner, dict):
        return ""
    return str(owner.get("walletAddress") or "").strip().lower()


def progression_url(player_ids: list[int], interval: str) -> str:
    """Return the canonical progression request URL for a planned player batch."""
    query = pipeline.urlencode(
        {
            "playersIds": ",".join(str(player_id) for player_id in player_ids),
            "interval": interval,
        }
    )
    return f"{pipeline.PROGRESSIONS_URL}?{query}"


def prepare_progression_batches(
    players: list[dict[str, Any]],
    interval: str,
) -> tuple[tuple[int, ...], ...]:
    """Build canonical progression batches bounded by player count and URL length."""
    excluded_wallets = {
        pipeline.MFL_WALLET_ADDRESS.lower(),
        pipeline.MFL_TRADE_WALLET_ADDRESS.lower(),
    }
    unique_players = {
        pipeline.player_id(player): player
        for player in players
    }
    eligible_ids = sorted(
        player_id
        for player_id, player in unique_players.items()
        if _owner_wallet_address(player) not in excluded_wallets
    )

    batches: list[tuple[int, ...]] = []
    current: list[int] = []
    for player_id in eligible_ids:
        candidate = [*current, player_id]
        candidate_url_length = len(progression_url(candidate, interval))
        if current and (
            len(candidate) > pipeline.PROGRESSION_BATCH_SIZE
            or candidate_url_length > PROGRESSION_MAX_URL_LENGTH
        ):
            batches.append(tuple(current))
            current = [player_id]
        else:
            current = candidate

        current_url_length = len(progression_url(current, interval))
        if current_url_length > PROGRESSION_MAX_URL_LENGTH:
            raise RuntimeError(
                f"Progression {interval} URL exceeds {PROGRESSION_MAX_URL_LENGTH} characters "
                f"for player {player_id}"
            )

    if current:
        batches.append(tuple(current))

    excluded_count = len(unique_players) - len(eligible_ids)
    longest_url = max(
        (len(progression_url(list(batch), interval)) for batch in batches),
        default=0,
    )
    pipeline.log(
        f"Progression {interval} batches ready: {len(batches)} batches from "
        f"{len(eligible_ids)} players; longest URL {longest_url}/"
        f"{PROGRESSION_MAX_URL_LENGTH} characters; excluded {excluded_count} "
        "MFL/MFL Trade players"
    )
    return tuple(batches)


def fetch_player_sources_and_prepare_progressions(
    fetcher: Any,
    limiter: RollingRateLimiter,
) -> dict[str, list[dict[str, Any]]]:
    """Fetch players, then freeze active and retired progression batches separately."""
    results = fetcher(limiter)
    active_players = results.get("general")
    retired_players = results.get("retired")
    if not isinstance(active_players, list):
        raise RuntimeError("Active player source was not available for progression batching")
    if not isinstance(retired_players, list):
        raise RuntimeError("Retired player source was not available for progression batching")

    global ACTIVE_PROGRESSION_BATCHES, RETIRED_PROGRESSION_BATCHES
    ACTIVE_PROGRESSION_BATCHES = prepare_progression_batches(
        active_players,
        "CURRENT_SEASON",
    )
    RETIRED_PROGRESSION_BATCHES = prepare_progression_batches(
        retired_players,
        "ALL",
    )
    return results


def restore_retired_all_progression(connection: Any) -> int:
    """Carry forward already-known retired ALL progression from the previous database."""
    if not PREVIOUS_DATABASE_PATH.exists():
        pipeline.log("No previous database available for retired ALL progression reuse.")
        return 0

    previous = sqlite3.connect(PREVIOUS_DATABASE_PATH)
    try:
        previous_columns = {
            str(row[1])
            for row in previous.execute("PRAGMA table_info(players)").fetchall()
        }
        required_columns = {"player_id", *ALL_PROGRESSION_COLUMNS}
        if not required_columns.issubset(previous_columns):
            pipeline.log(
                "Previous database does not contain the complete retired ALL progression schema; "
                "missing values will be fetched."
            )
            return 0

        complete_values = " AND ".join(
            f"{column} IS NOT NULL" for column in ALL_PROGRESSION_COLUMNS
        )
        selected_columns = ", ".join(("player_id", *ALL_PROGRESSION_COLUMNS))
        rows = previous.execute(
            f"SELECT {selected_columns} FROM players WHERE {complete_values}"
        ).fetchall()
    finally:
        previous.close()

    assignments = ", ".join(
        f"{column} = ?" for column in ALL_PROGRESSION_COLUMNS
    )
    before_changes = int(connection.total_changes)
    connection.executemany(
        f"UPDATE players SET {assignments} WHERE player_id = ? AND retirement_years = 0",
        [tuple(row[1:]) + (int(row[0]),) for row in rows],
    )
    connection.commit()
    restored = int(connection.total_changes) - before_changes
    pipeline.log(f"Retired ALL progression reused from previous database: {restored}")
    return restored


def missing_retired_all_player_ids(connection: Any) -> set[int]:
    """Return retired non-special-wallet players whose ALL progression is still unset."""
    missing_values = " OR ".join(
        f"{column} IS NULL" for column in ALL_PROGRESSION_COLUMNS
    )
    rows = connection.execute(
        f"""
        SELECT player_id
        FROM players
        WHERE retirement_years = 0
          AND lower(wallet_address) NOT IN (?, ?)
          AND ({missing_values})
        ORDER BY player_id
        """,
        (
            pipeline.MFL_WALLET_ADDRESS.lower(),
            pipeline.MFL_TRADE_WALLET_ADDRESS.lower(),
        ),
    ).fetchall()
    return {int(row[0]) for row in rows}


def refresh_progressions_from_prepared_batches(
    connection: Any,
    limiter: RollingRateLimiter,
) -> dict[str, int]:
    """Fetch active ALL/current progression and only missing retired ALL progression."""
    if ACTIVE_PROGRESSION_BATCHES is None or RETIRED_PROGRESSION_BATCHES is None:
        raise RuntimeError("Progression batches were not prepared after player loading")

    active_batches = [list(batch) for batch in ACTIVE_PROGRESSION_BATCHES]
    restore_retired_all_progression(connection)
    missing_retired_ids = missing_retired_all_player_ids(connection)
    retired_all_batches = [
        [player_id for player_id in batch if player_id in missing_retired_ids]
        for batch in RETIRED_PROGRESSION_BATCHES
    ]
    retired_all_batches = [batch for batch in retired_all_batches if batch]

    pipeline.log(
        f"Retired ALL progression still missing: {len(missing_retired_ids)} players "
        f"across {len(retired_all_batches)} batches."
    )

    jobs = [
        ("ALL", "all", batch)
        for batch in active_batches
    ] + [
        ("CURRENT_SEASON", "current_season", batch)
        for batch in active_batches
    ] + [
        ("ALL", "all", batch)
        for batch in retired_all_batches
    ]
    batch_totals = {
        "ALL": len(active_batches) + len(retired_all_batches),
        "CURRENT_SEASON": len(active_batches),
    }
    totals = {"ALL": 0, "CURRENT_SEASON": 0}
    completed = {"ALL": 0, "CURRENT_SEASON": 0}

    with ThreadPoolExecutor(
        max_workers=min(pipeline.MFL_WORKERS, max(1, len(jobs)))
    ) as executor:
        futures = {
            executor.submit(
                pipeline.progression_request,
                batch,
                interval,
                limiter,
            ): (interval, suffix, batch)
            for interval, suffix, batch in jobs
        }
        for future in as_completed(futures):
            interval, suffix, batch = futures[future]
            data = future.result()
            rows = [
                tuple(
                    pipeline.progression_value(data.get(str(player_id)), attribute)
                    for attribute in pipeline.ATTRIBUTES
                ) + (player_id,)
                for player_id in batch
            ]
            assignments = ", ".join(
                f"{attribute}_prog_{suffix} = ?"
                for attribute in pipeline.ATTRIBUTES
            )
            connection.executemany(
                f"UPDATE players SET {assignments} WHERE player_id = ?",
                rows,
            )
            connection.commit()
            completed[interval] += 1
            totals[interval] += len(rows)
            pipeline.log(
                f"Progression {interval} batch {completed[interval]}/{batch_totals[interval]}: "
                f"updated {len(rows)}"
            )

    return totals


def main() -> int:
    pipeline.MFL_WORKERS = 320
    pipeline.RateLimiter = RollingRateLimiter
    pipeline.refresh_wallets = refresh_wallets_without_playmfl_limiter

    configured_player_fetcher = fetch_all_player_sources
    pipeline.fetch_all_player_sources = lambda limiter: (
        fetch_player_sources_and_prepare_progressions(configured_player_fetcher, limiter)
    )
    pipeline.refresh_progressions = refresh_progressions_from_prepared_batches

    pipeline.log(
        f"PlayMFL runtime configuration: "
        f"{pipeline.MFL_REQUESTS_PER_MINUTE} starts/min, "
        f"{pipeline.MFL_WORKERS} workers"
    )
    return pipeline.main()


if __name__ == "__main__":
    raise SystemExit(main())
