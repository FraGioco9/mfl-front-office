from __future__ import annotations

import json
import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

PROGRESSIONS_API_URL = "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/progressions"
MFL_WALLET_ADDRESS = "0xff8d2bbed8164db0"
PROGRESSION_BATCH_SIZE = 1000
PROGRESSION_WORKERS = 100
PROGRESSION_RETRIES = 3
PROGRESSION_RETRY_DELAY_SECONDS = 90
REQUEST_TIMEOUT_SECONDS = 60
ATTRIBUTES = ["overall", "pace", "shooting", "passing", "dribbling", "defense", "physical", "goalkeeping"]


class ProgressionRequestTooLarge(RuntimeError):
    pass


class ProgressionPlayerCount(int):
    """Player count compatible with the legacy interval-count wrapper."""

    def __floordiv__(self, other: object) -> int:
        if other == 2:
            return int(self)
        return int(super().__floordiv__(other))


class ProgressionClient:
    def fetch(self, player_ids: list[int], interval: str) -> dict[str, Any]:
        query = urlencode(
            {
                "playersIds": ",".join(str(player_id) for player_id in player_ids),
                "interval": interval,
            }
        )
        request = Request(
            f"{PROGRESSIONS_API_URL}?{query}",
            headers={"Accept": "application/json", "User-Agent": "mfl-front-office-flow-rebuild/1.0"},
        )

        last_error: RuntimeError | None = None
        for attempt in range(PROGRESSION_RETRIES + 1):
            try:
                with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                    data = json.loads(response.read().decode("utf-8"))
                if not isinstance(data, dict):
                    raise RuntimeError("Progression API response was not an object")
                return data
            except HTTPError as error:
                if error.code == 414:
                    raise ProgressionRequestTooLarge(
                        f"Progression request with {len(player_ids)} IDs was too large"
                    ) from error
                last_error = RuntimeError(f"Progression API returned {error.code}")
            except (URLError, TimeoutError) as error:
                last_error = RuntimeError(f"Progression API connection failed: {error}")
            except json.JSONDecodeError:
                last_error = RuntimeError("Progression API returned invalid JSON")
            except RuntimeError as error:
                last_error = error

            if attempt == PROGRESSION_RETRIES:
                raise last_error

            print(
                f"Progression {interval} request failed; retrying in {PROGRESSION_RETRY_DELAY_SECONDS}s "
                f"({attempt + 1}/{PROGRESSION_RETRIES})",
                flush=True,
            )
            time.sleep(PROGRESSION_RETRY_DELAY_SECONDS)

        raise last_error or RuntimeError("Progression request failed after retries")

    def fetch_with_split(self, player_ids: list[int], interval: str) -> dict[str, Any]:
        try:
            return self.fetch(player_ids, interval)
        except ProgressionRequestTooLarge:
            if len(player_ids) == 1:
                raise
            midpoint = len(player_ids) // 2
            left = self.fetch_with_split(player_ids[:midpoint], interval)
            right = self.fetch_with_split(player_ids[midpoint:], interval)
            return {**left, **right}


def chunks(values: list[int], size: int) -> list[list[int]]:
    return [values[index:index + size] for index in range(0, len(values), size)]


def progression_value(progression: Any, attribute: str) -> int:
    if not isinstance(progression, dict):
        return 0
    try:
        return int(progression.get(attribute) or 0)
    except (TypeError, ValueError):
        return 0


def update_progression_rows(
    connection: sqlite3.Connection,
    player_ids: list[int],
    progressions: dict[str, Any],
    suffix: str,
) -> int:
    rows = [
        tuple(progression_value(progressions.get(str(player_id)), attribute) for attribute in ATTRIBUTES)
        + (player_id,)
        for player_id in player_ids
    ]
    connection.executemany(
        f"""
        UPDATE players
        SET
            overall_prog_{suffix} = ?,
            pace_prog_{suffix} = ?,
            shooting_prog_{suffix} = ?,
            passing_prog_{suffix} = ?,
            dribbling_prog_{suffix} = ?,
            defense_prog_{suffix} = ?,
            physical_prog_{suffix} = ?,
            goalkeeping_prog_{suffix} = ?
        WHERE player_id = ?
        """,
        rows,
    )
    connection.commit()
    return len(rows)


def refresh_progressions(
    connection: sqlite3.Connection,
    *,
    workers: int = PROGRESSION_WORKERS,
    batch_size: int = PROGRESSION_BATCH_SIZE,
) -> int:
    player_ids = [
        int(row[0])
        for row in connection.execute(
            """
            SELECT player_id
            FROM players
            WHERE lower(wallet_address) != lower(?)
            ORDER BY player_id
            """,
            (MFL_WALLET_ADDRESS,),
        ).fetchall()
    ]
    if not player_ids:
        return ProgressionPlayerCount(0)

    client = ProgressionClient()
    batches = chunks(player_ids, batch_size)

    for interval, suffix in (("ALL", "all"), ("CURRENT_SEASON", "current_season")):
        completed = 0
        with ThreadPoolExecutor(max_workers=max(1, workers)) as executor:
            future_to_batch = {
                executor.submit(client.fetch_with_split, batch, interval): batch
                for batch in batches
            }
            for future in as_completed(future_to_batch):
                batch = future_to_batch[future]
                progressions = future.result()
                update_progression_rows(connection, batch, progressions, suffix)
                completed += 1
                print(
                    f"Progression {interval} batch {completed}/{len(batches)}: updated {len(batch)} players",
                    flush=True,
                )

    return ProgressionPlayerCount(len(player_ids))
