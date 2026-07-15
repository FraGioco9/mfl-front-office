import argparse
import json
import sqlite3
import sys
import time
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from populate_seasons_from_flow import populate_flow_static_fields


DATABASE_PATH = Path(__file__).with_name("mfl_progression.db")
LEADERBOARD_API_URL = "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/leaderboards/users/global"
PLAYERS_API_URL = "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players"
PROGRESSIONS_API_URL = "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/progressions"
MFL_WALLET_ADDRESS = "0xff8d2bbed8164db0"
MFL_WALLET_NAME = "MFL"
API_LIMIT = 1500
MFL_API_LIMIT = 500
PROGRESSION_BATCH_SIZE = 1000
REQUEST_TIMEOUT_SECONDS = 60
SLEEP_SECONDS_BETWEEN_REQUESTS = 0.15
SLEEP_SECONDS_BETWEEN_MFL_REQUESTS = 2.0
SLEEP_SECONDS_BEFORE_MFL_WALLET = 90.0
MAX_REQUEST_RETRIES = 3
MFL_MAX_REQUEST_RETRIES = 10
RETRY_STATUS_CODES = {403, 429, 500, 502, 503, 504}


ATTRIBUTES = [
    "overall",
    "pace",
    "shooting",
    "passing",
    "dribbling",
    "defense",
    "physical",
    "goalkeeping",
]

STAT_ATTRIBUTES = [
    "pace",
    "shooting",
    "passing",
    "dribbling",
    "defense",
    "physical",
    "goalkeeping",
]

POSITION_GROUP_WEIGHTS = {
    "ST": {"passing": 10, "shooting": 46, "defense": 0, "dribbling": 29, "pace": 10, "physical": 5, "goalkeeping": 0},
    "CF": {"passing": 24, "shooting": 23, "defense": 0, "dribbling": 40, "pace": 13, "physical": 0, "goalkeeping": 0},
    "LW": {"passing": 24, "shooting": 23, "defense": 0, "dribbling": 40, "pace": 13, "physical": 0, "goalkeeping": 0},
    "RW": {"passing": 24, "shooting": 23, "defense": 0, "dribbling": 40, "pace": 13, "physical": 0, "goalkeeping": 0},
    "CAM": {"passing": 34, "shooting": 21, "defense": 0, "dribbling": 38, "pace": 7, "physical": 0, "goalkeeping": 0},
    "CM": {"passing": 43, "shooting": 12, "defense": 10, "dribbling": 29, "pace": 0, "physical": 6, "goalkeeping": 0},
    "LM": {"passing": 43, "shooting": 12, "defense": 10, "dribbling": 29, "pace": 0, "physical": 6, "goalkeeping": 0},
    "RM": {"passing": 43, "shooting": 12, "defense": 10, "dribbling": 29, "pace": 0, "physical": 6, "goalkeeping": 0},
    "CDM": {"passing": 28, "shooting": 0, "defense": 40, "dribbling": 17, "pace": 0, "physical": 15, "goalkeeping": 0},
    "LWB": {"passing": 19, "shooting": 0, "defense": 44, "dribbling": 17, "pace": 10, "physical": 10, "goalkeeping": 0},
    "RWB": {"passing": 19, "shooting": 0, "defense": 44, "dribbling": 17, "pace": 10, "physical": 10, "goalkeeping": 0},
    "LB": {"passing": 19, "shooting": 0, "defense": 44, "dribbling": 17, "pace": 10, "physical": 10, "goalkeeping": 0},
    "RB": {"passing": 19, "shooting": 0, "defense": 44, "dribbling": 17, "pace": 10, "physical": 10, "goalkeeping": 0},
    "CB": {"passing": 5, "shooting": 0, "defense": 64, "dribbling": 9, "pace": 2, "physical": 20, "goalkeeping": 0},
    "GK": {"passing": 0, "shooting": 0, "defense": 0, "dribbling": 0, "pace": 0, "physical": 0, "goalkeeping": 100},
}


class ProgressionRequestTooLargeError(RuntimeError):
    pass


def create_players_table(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS players (
            player_id INTEGER PRIMARY KEY,
            wallet_address TEXT NOT NULL,
            wallet_name TEXT NOT NULL DEFAULT '',
            name TEXT,
            positions TEXT,
            age INTEGER,
            nationality TEXT,
            preferred_foot TEXT,
            height INTEGER,
            retirement_years INTEGER,
            overall INTEGER,
            pace INTEGER,
            shooting INTEGER,
            passing INTEGER,
            dribbling INTEGER,
            defense INTEGER,
            physical INTEGER,
            goalkeeping INTEGER,
            player_seasons INTEGER,
            overall_prog_all INTEGER,
            pace_prog_all INTEGER,
            shooting_prog_all INTEGER,
            passing_prog_all INTEGER,
            dribbling_prog_all INTEGER,
            defense_prog_all INTEGER,
            physical_prog_all INTEGER,
            goalkeeping_prog_all INTEGER,
            overall_prog_current_season INTEGER,
            pace_prog_current_season INTEGER,
            shooting_prog_current_season INTEGER,
            passing_prog_current_season INTEGER,
            dribbling_prog_current_season INTEGER,
            defense_prog_current_season INTEGER,
            physical_prog_current_season INTEGER,
            goalkeeping_prog_current_season INTEGER,
            next_overall REAL,
            next_overall_gap REAL,
            pace_to_next_overall REAL,
            shooting_to_next_overall REAL,
            passing_to_next_overall REAL,
            dribbling_to_next_overall REAL,
            defense_to_next_overall REAL,
            physical_to_next_overall REAL,
            goalkeeping_to_next_overall REAL
        )
        """
    )
    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS players_wallet_address_index
        ON players (wallet_address)
        """
    )
    ensure_players_columns(connection)


def recreate_wallet_table(connection: sqlite3.Connection) -> None:
    connection.execute("DROP TABLE IF EXISTS wallets")
    connection.execute(
        """
        CREATE TABLE wallets (
            wallet_address TEXT PRIMARY KEY,
            name TEXT NOT NULL DEFAULT ''
        )
        """
    )


def refresh_wallets(connection: sqlite3.Connection) -> int:
    data = fetch_leaderboard_data()
    users = data["users"]
    saved_count = 0
    mfl_wallet_seen = False

    recreate_wallet_table(connection)

    for user in users:
        if not isinstance(user, dict):
            continue

        wallet_address = to_text(user.get("walletAddress")).strip().lower()
        if not wallet_address:
            continue

        if wallet_address == MFL_WALLET_ADDRESS:
            mfl_wallet_seen = True

        connection.execute(
            """
            INSERT INTO wallets (
                wallet_address,
                name
            )
            VALUES (?, ?)
            """,
            (
                wallet_address,
                MFL_WALLET_NAME if wallet_address == MFL_WALLET_ADDRESS else to_text(user.get("name")),
            ),
        )
        saved_count += 1

    if not mfl_wallet_seen:
        connection.execute(
            """
            INSERT INTO wallets (
                wallet_address,
                name
            )
            VALUES (?, ?)
            """,
            (
                MFL_WALLET_ADDRESS,
                MFL_WALLET_NAME,
            ),
        )
        saved_count += 1

    connection.commit()
    return saved_count


def fetch_leaderboard_data() -> dict[str, Any]:
    request = Request(
        LEADERBOARD_API_URL,
        headers={
            "Accept": "application/json",
            "User-Agent": "mfl-progression-wallet-refresh/1.0",
        },
    )
    data = fetch_json_with_retries(request, "MFL leaderboard API")

    if not isinstance(data, dict):
        raise RuntimeError("MFL leaderboard API response was not an object")

    users = data.get("users")
    if not isinstance(users, list):
        raise RuntimeError("MFL leaderboard API response did not contain a users list")

    return data


def ensure_players_columns(connection: sqlite3.Connection) -> None:
    existing_columns = {
        row[1]
        for row in connection.execute("PRAGMA table_info(players)").fetchall()
    }
    expected_columns = {
        "overall": "INTEGER",
        "pace": "INTEGER",
        "shooting": "INTEGER",
        "passing": "INTEGER",
        "dribbling": "INTEGER",
        "defense": "INTEGER",
        "physical": "INTEGER",
        "goalkeeping": "INTEGER",
        "player_seasons": "INTEGER",
        "overall_prog_all": "INTEGER",
        "pace_prog_all": "INTEGER",
        "shooting_prog_all": "INTEGER",
        "passing_prog_all": "INTEGER",
        "dribbling_prog_all": "INTEGER",
        "defense_prog_all": "INTEGER",
        "physical_prog_all": "INTEGER",
        "goalkeeping_prog_all": "INTEGER",
        "overall_prog_current_season": "INTEGER",
        "pace_prog_current_season": "INTEGER",
        "shooting_prog_current_season": "INTEGER",
        "passing_prog_current_season": "INTEGER",
        "dribbling_prog_current_season": "INTEGER",
        "defense_prog_current_season": "INTEGER",
        "physical_prog_current_season": "INTEGER",
        "goalkeeping_prog_current_season": "INTEGER",
        "next_overall": "REAL",
        "next_overall_gap": "REAL",
        "pace_to_next_overall": "REAL",
        "shooting_to_next_overall": "REAL",
        "passing_to_next_overall": "REAL",
        "dribbling_to_next_overall": "REAL",
        "defense_to_next_overall": "REAL",
        "physical_to_next_overall": "REAL",
        "goalkeeping_to_next_overall": "REAL",
    }

    if "seasons" in existing_columns and "player_seasons" not in existing_columns:
        connection.execute("ALTER TABLE players RENAME COLUMN seasons TO player_seasons")
        existing_columns.remove("seasons")
        existing_columns.add("player_seasons")

    if "player_seasons" not in existing_columns:
        connection.execute("ALTER TABLE players ADD COLUMN player_seasons INTEGER")
        existing_columns.add("player_seasons")

    if "age_at_mint" in existing_columns:
        connection.execute(
            """
            UPDATE players
            SET player_seasons = age - age_at_mint + 1
            WHERE player_seasons IS NULL
                AND age IS NOT NULL
                AND age_at_mint IS NOT NULL
            """
        )
        connection.execute("ALTER TABLE players DROP COLUMN age_at_mint")
        existing_columns.remove("age_at_mint")

    for column_name, column_type in expected_columns.items():
        if column_name not in existing_columns:
            connection.execute(f"ALTER TABLE players ADD COLUMN {column_name} {column_type}")


def append_mfl_wallet(wallets: list[dict[str, str]]) -> list[dict[str, str]]:
    for wallet in wallets:
        if wallet["wallet_address"].lower() == MFL_WALLET_ADDRESS:
            wallet["wallet_name"] = MFL_WALLET_NAME
            return wallets

    wallets.append({"wallet_address": MFL_WALLET_ADDRESS, "wallet_name": MFL_WALLET_NAME})
    return wallets


def get_wallets(
    connection: sqlite3.Connection,
    limit: int | None,
    wallet_address: str | None,
) -> list[dict[str, str]]:
    if wallet_address:
        row = connection.execute(
            """
            SELECT wallet_address, name
            FROM wallets
            WHERE wallet_address = ?
            """,
            (wallet_address.lower(),),
        ).fetchone()

        if row:
            return [{"wallet_address": row[0], "wallet_name": row[1]}]

        return [{"wallet_address": wallet_address.lower(), "wallet_name": ""}]

    limit_sql = ""
    parameters: list[Any] = []

    if limit is not None:
        limit_sql = "LIMIT ?"
        parameters.append(limit)

    rows = connection.execute(
        f"""
        SELECT wallet_address, name
        FROM wallets
        {limit_sql}
        """,
        parameters,
    ).fetchall()

    wallets = [{"wallet_address": row[0], "wallet_name": row[1]} for row in rows]
    return append_mfl_wallet(wallets)


def is_mfl_wallet(wallet_address: str) -> bool:
    return wallet_address.lower() == MFL_WALLET_ADDRESS


def fetch_players_page(
    wallet_address: str,
    before_player_id: int | None,
    limit: int = API_LIMIT,
    max_retries: int = MAX_REQUEST_RETRIES,
) -> list[dict[str, Any]]:
    query = {
        "limit": limit,
        "ownerWalletAddress": wallet_address,
    }

    if before_player_id is not None:
        query["beforePlayerId"] = before_player_id

    url = f"{PLAYERS_API_URL}?{urlencode(query)}"
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "mfl-progression-player-refresh/1.0",
        },
    )

    try:
        data = fetch_json_with_retries(request, "MFL players API", max_retries=max_retries)
    except URLError as error:
        raise RuntimeError(f"Could not connect to MFL players API: {error.reason}") from error
    except json.JSONDecodeError as error:
        raise RuntimeError("MFL players API response was not valid JSON") from error

    if not isinstance(data, list):
        raise RuntimeError("MFL players API response was not a list")

    return data


def fetch_progressions_batch(player_ids: list[int], interval: str) -> dict[str, Any]:
    query = {
        "playersIds": ",".join(str(player_id) for player_id in player_ids),
        "interval": interval,
    }
    url = f"{PROGRESSIONS_API_URL}?{urlencode(query)}"
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "mfl-progression-progression-refresh/1.0",
        },
    )

    try:
        data = fetch_json_with_retries(
            request,
            "MFL progressions API",
            too_large_message=f"MFL progressions API rejected {len(player_ids)} player IDs as too large",
        )
    except URLError as error:
        raise RuntimeError(f"Could not connect to MFL progressions API: {error.reason}") from error
    except json.JSONDecodeError as error:
        raise RuntimeError("MFL progressions API response was not valid JSON") from error

    if not isinstance(data, dict):
        raise RuntimeError("MFL progressions API response was not an object")

    return data


def fetch_json_with_retries(
    request: Request,
    api_name: str,
    too_large_message: str | None = None,
    max_retries: int = MAX_REQUEST_RETRIES,
) -> Any:
    for attempt in range(max_retries + 1):
        try:
            with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            if error.code == 414 and too_large_message is not None:
                raise ProgressionRequestTooLargeError(too_large_message) from error

            if error.code not in RETRY_STATUS_CODES or attempt == max_retries:
                raise RuntimeError(f"{api_name} returned status code {error.code}") from error

            sleep_seconds = retry_delay_seconds(attempt)
            print(
                f"{api_name} returned {error.code}; retrying in {sleep_seconds:.1f}s "
                f"({attempt + 1}/{max_retries})"
            )
            time.sleep(sleep_seconds)
        except URLError:
            if attempt == max_retries:
                raise

            sleep_seconds = retry_delay_seconds(attempt)
            print(
                f"{api_name} connection failed; retrying in {sleep_seconds:.1f}s "
                f"({attempt + 1}/{max_retries})"
            )
            time.sleep(sleep_seconds)

    raise RuntimeError(f"{api_name} request failed after retries")


def retry_delay_seconds(attempt: int) -> float:
    return 90.0


def chunks(values: list[int], size: int) -> list[list[int]]:
    return [values[index:index + size] for index in range(0, len(values), size)]


def fetch_wallet_players(wallet_address: str) -> list[dict[str, Any]]:
    all_players = []
    seen_player_ids = set()
    before_player_id = None
    page_limit = MFL_API_LIMIT if is_mfl_wallet(wallet_address) else API_LIMIT
    request_sleep = SLEEP_SECONDS_BETWEEN_MFL_REQUESTS if is_mfl_wallet(wallet_address) else SLEEP_SECONDS_BETWEEN_REQUESTS
    max_retries = MFL_MAX_REQUEST_RETRIES if is_mfl_wallet(wallet_address) else MAX_REQUEST_RETRIES

    while True:
        page = fetch_players_page(wallet_address, before_player_id, page_limit, max_retries)

        if not page:
            break

        for player in page:
            player_id = player.get("id")

            if player_id in seen_player_ids:
                continue

            seen_player_ids.add(player_id)
            all_players.append(player)

        if len(page) < page_limit:
            break

        next_before_player_id = page[-1].get("id")
        if next_before_player_id is None or next_before_player_id == before_player_id:
            break

        before_player_id = int(next_before_player_id)
        time.sleep(request_sleep)

    return all_players


def to_int(value: Any) -> int | None:
    if value is None or value == "":
        return None

    return int(value)


def to_text(value: Any) -> str:
    if value is None:
        return ""

    return str(value)


def join_values(value: Any) -> str:
    if isinstance(value, list):
        return ", ".join(str(item) for item in value)

    if value is None:
        return ""

    return str(value)


def player_name(metadata: dict[str, Any]) -> str:
    first_name = str(metadata.get("firstName") or "").strip()
    last_name = str(metadata.get("lastName") or "").strip()
    return f"{first_name} {last_name}".strip()


def insert_players(
    connection: sqlite3.Connection,
    players: list[dict[str, Any]],
    wallet_address: str,
    wallet_name: str,
) -> list[int]:
    rows = []
    player_ids = []

    for player in players:
        metadata = player.get("metadata") or {}
        owned_by = player.get("ownedBy") or {}
        player_id = player.get("id")

        if player_id is None:
            continue

        numeric_player_id = to_int(player_id)
        if numeric_player_id is None:
            continue

        player_ids.append(numeric_player_id)
        rows.append(
            (
                numeric_player_id,
                str(owned_by.get("walletAddress") or wallet_address).lower(),
                wallet_name or str(owned_by.get("name") or ""),
                player_name(metadata),
                join_values(metadata.get("positions")),
                to_int(metadata.get("age")),
                join_values(metadata.get("nationalities")),
                str(metadata.get("preferredFoot") or ""),
                to_int(metadata.get("height")),
                to_int(metadata.get("retirementYears")),
                to_int(metadata.get("overall")),
                to_int(metadata.get("pace")),
                to_int(metadata.get("shooting")),
                to_int(metadata.get("passing")),
                to_int(metadata.get("dribbling")),
                to_int(metadata.get("defense")),
                to_int(metadata.get("physical")),
                to_int(metadata.get("goalkeeping")),
            )
        )

    connection.executemany(
        """
        INSERT INTO players (
            player_id,
            wallet_address,
            wallet_name,
            name,
            positions,
            age,
            nationality,
            preferred_foot,
            height,
            retirement_years,
            overall,
            pace,
            shooting,
            passing,
            dribbling,
            defense,
            physical,
            goalkeeping
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(player_id) DO UPDATE SET
            wallet_address = excluded.wallet_address,
            wallet_name = excluded.wallet_name,
            name = excluded.name,
            positions = excluded.positions,
            age = excluded.age,
            nationality = excluded.nationality,
            preferred_foot = excluded.preferred_foot,
            height = excluded.height,
            retirement_years = excluded.retirement_years,
            overall = excluded.overall,
            pace = excluded.pace,
            shooting = excluded.shooting,
            passing = excluded.passing,
            dribbling = excluded.dribbling,
            defense = excluded.defense,
            physical = excluded.physical,
            goalkeeping = excluded.goalkeeping
        """,
        rows,
    )
    return player_ids


def primary_position(positions: Any) -> str:
    return str(positions or "").split(",")[0].strip().upper()


def next_overall_target(display_overall: Any, precise_overall: float) -> float:
    displayed = int(float(display_overall or 0))
    target = displayed + 0.5
    rounded_precise = round(precise_overall, 2)

    if displayed == int(rounded_precise) and abs(rounded_precise - target) < 0.000001:
        return round(target + 0.01, 2)

    return target


def next_overall_values(row: sqlite3.Row) -> tuple[Any, ...]:
    primary = primary_position(row["positions"])
    weights = POSITION_GROUP_WEIGHTS.get(primary)

    if not weights:
        return (None, None, *([None] * len(STAT_ATTRIBUTES)))

    weighted = 0.0
    for attribute, weight in weights.items():
        value = row[attribute]
        weighted += ((float(value or 0)) * weight) / 100

    display_overall = row["goalkeeping"] if primary == "GK" and row["goalkeeping"] is not None else row["overall"]
    if display_overall is None:
        display_overall = weighted

    max_overall = float(display_overall or 0) >= 99
    target = next_overall_target(display_overall, weighted)
    gap = max(0.0, target - weighted)

    needed_values = []
    for attribute in STAT_ATTRIBUTES:
        value = row[attribute]
        weight = weights.get(attribute, 0)

        if weight <= 0 or max_overall or (value is not None and float(value) >= 99):
            needed_values.append(None)
        else:
            needed_values.append(round(gap / (weight / 100), 4))

    return (round(weighted, 4), round(gap, 4), *needed_values)


def update_next_overall_columns(connection: sqlite3.Connection, player_ids: list[int] | None = None) -> int:
    ensure_players_columns(connection)
    connection.row_factory = sqlite3.Row

    if player_ids is None:
        batches: list[list[int] | None] = [None]
    else:
        unique_ids = sorted(set(player_ids))
        if not unique_ids:
            return 0
        batches = chunks(unique_ids, PROGRESSION_BATCH_SIZE)

    total_updated = 0
    total_batches = len(batches)

    for index, batch in enumerate(batches, start=1):
        parameters: list[Any] = []
        where_sql = ""

        if batch:
            placeholders = ",".join("?" for _ in batch)
            where_sql = f"WHERE player_id IN ({placeholders})"
            parameters = batch

        rows = connection.execute(
            f"""
            SELECT player_id, positions, overall, pace, shooting, passing, dribbling, defense, physical, goalkeeping
            FROM players
            {where_sql}
            """,
            parameters,
        ).fetchall()
        updates = [(*next_overall_values(row), row["player_id"]) for row in rows]

        if not updates:
            print(f"Next Overall batch {index}/{total_batches}: updated 0 players", flush=True)
            continue

        connection.executemany(
            """
            UPDATE players
            SET
                next_overall = ?,
                next_overall_gap = ?,
                pace_to_next_overall = ?,
                shooting_to_next_overall = ?,
                passing_to_next_overall = ?,
                dribbling_to_next_overall = ?,
                defense_to_next_overall = ?,
                physical_to_next_overall = ?,
                goalkeeping_to_next_overall = ?
            WHERE player_id = ?
            """,
            updates,
        )
        connection.commit()
        total_updated += len(updates)
        print(f"Next Overall batch {index}/{total_batches}: updated {len(updates)} players", flush=True)

    return total_updated


def progression_value(progression: Any, attribute: str) -> int | None:
    if not isinstance(progression, dict):
        return 0

    value = to_int(progression.get(attribute))
    if value is None:
        return 0

    return value


def update_progression_columns(
    connection: sqlite3.Connection,
    player_ids: list[int],
    interval: str,
    column_suffix: str,
    workers: int,
) -> int:
    total_updated = 0
    batches = chunks(player_ids, PROGRESSION_BATCH_SIZE)
    total_batches = len(batches)
    completed_batches = 0

    if workers > 1:
        with ThreadPoolExecutor(max_workers=workers) as executor:
            future_to_batch = {
                executor.submit(fetch_progressions_batch_with_split, batch, interval): batch
                for batch in batches
            }

            for future in as_completed(future_to_batch):
                batch = future_to_batch[future]
                progressions = future.result()
                updated_count = update_progression_rows(
                    connection,
                    batch,
                    progressions,
                    column_suffix,
                )
                total_updated += updated_count
                completed_batches += 1
                print(
                    f"{column_suffix.upper()} progression batch "
                    f"{completed_batches}/{total_batches}: updated {updated_count} rows"
                )

        return total_updated

    for batch in batches:
        updated_count = update_progression_batch(connection, batch, interval, column_suffix)
        total_updated += updated_count
        completed_batches += 1
        print(
            f"{column_suffix.upper()} progression batch "
            f"{completed_batches}/{total_batches}: updated {updated_count} rows"
        )

    return total_updated


def fetch_progressions_batch_with_split(player_ids: list[int], interval: str) -> dict[str, Any]:
    try:
        return fetch_progressions_batch(player_ids, interval)
    except ProgressionRequestTooLargeError:
        if len(player_ids) == 1:
            raise

        midpoint = len(player_ids) // 2
        left = fetch_progressions_batch_with_split(player_ids[:midpoint], interval)
        right = fetch_progressions_batch_with_split(player_ids[midpoint:], interval)
        return {**left, **right}


def update_progression_batch(
    connection: sqlite3.Connection,
    player_ids: list[int],
    interval: str,
    column_suffix: str,
) -> int:
    try:
        progressions = fetch_progressions_batch(player_ids, interval)
    except ProgressionRequestTooLargeError:
        if len(player_ids) == 1:
            raise

        midpoint = len(player_ids) // 2
        left_count = update_progression_batch(connection, player_ids[:midpoint], interval, column_suffix)
        right_count = update_progression_batch(connection, player_ids[midpoint:], interval, column_suffix)
        return left_count + right_count

    return update_progression_rows(connection, player_ids, progressions, column_suffix)


def update_progression_rows(
    connection: sqlite3.Connection,
    player_ids: list[int],
    progressions: dict[str, Any],
    column_suffix: str,
) -> int:
    rows = []

    for player_id in player_ids:
        progression = progressions.get(str(player_id))
        rows.append(
            tuple(progression_value(progression, attribute) for attribute in ATTRIBUTES)
            + (player_id,)
        )

    before_changes = connection.total_changes
    connection.executemany(
        f"""
        UPDATE players
        SET
            overall_prog_{column_suffix} = ?,
            pace_prog_{column_suffix} = ?,
            shooting_prog_{column_suffix} = ?,
            passing_prog_{column_suffix} = ?,
            dribbling_prog_{column_suffix} = ?,
            defense_prog_{column_suffix} = ?,
            physical_prog_{column_suffix} = ?,
            goalkeeping_prog_{column_suffix} = ?
        WHERE player_id = ?
        """,
        rows,
    )
    updated_count = connection.total_changes - before_changes
    connection.commit()
    time.sleep(SLEEP_SECONDS_BETWEEN_REQUESTS)
    return updated_count


def refresh_progressions(connection: sqlite3.Connection, player_ids: list[int], workers: int) -> None:
    unique_player_ids = get_player_ids_requiring_progression(connection, sorted(set(player_ids)))

    if not unique_player_ids:
        print("Progression refresh skipped: no players need progression updates.")
        return

    print(f"Progression refresh: fetching {len(unique_player_ids)} players.")
    all_updated = update_progression_columns(connection, unique_player_ids, "ALL", "all", workers)
    current_updated = update_progression_columns(
        connection,
        unique_player_ids,
        "CURRENT_SEASON",
        "current_season",
        workers,
    )
    print(
        f"Progression refresh complete: updated {all_updated} ALL rows "
        f"and {current_updated} CURRENT_SEASON rows."
    )


def get_player_ids_requiring_progression(
    connection: sqlite3.Connection,
    player_ids: list[int],
) -> list[int]:
    if not player_ids:
        return []

    required_ids = []

    for batch in chunks(player_ids, PROGRESSION_BATCH_SIZE):
        placeholders = ", ".join("?" for _ in batch)
        rows = connection.execute(
            f"""
            SELECT player_id
            FROM players
            WHERE player_id IN ({placeholders})
                AND lower(wallet_address) != ?
                AND (
                    retirement_years IS NULL
                    OR retirement_years != 0
                    OR overall_prog_all IS NULL
                    OR pace_prog_all IS NULL
                    OR shooting_prog_all IS NULL
                    OR passing_prog_all IS NULL
                    OR dribbling_prog_all IS NULL
                    OR defense_prog_all IS NULL
                    OR physical_prog_all IS NULL
                    OR goalkeeping_prog_all IS NULL
                    OR overall_prog_current_season IS NULL
                    OR pace_prog_current_season IS NULL
                    OR shooting_prog_current_season IS NULL
                    OR passing_prog_current_season IS NULL
                    OR dribbling_prog_current_season IS NULL
                    OR defense_prog_current_season IS NULL
                    OR physical_prog_current_season IS NULL
                    OR goalkeeping_prog_current_season IS NULL
                )
            ORDER BY player_id
            """,
            [*batch, MFL_WALLET_ADDRESS],
        ).fetchall()
        required_ids.extend(row[0] for row in rows)

    return required_ids


def save_wallet_players(
    connection: sqlite3.Connection,
    wallet: dict[str, str],
) -> tuple[int, list[int]]:
    current_wallet_address = wallet["wallet_address"]
    players = fetch_wallet_players(current_wallet_address)
    player_ids = insert_players(connection, players, current_wallet_address, wallet["wallet_name"])
    connection.commit()
    return len(players), player_ids


def refresh_players(
    connection: sqlite3.Connection,
    limit: int | None,
    wallet_address: str | None,
    workers: int,
) -> int:
    wallets = get_wallets(connection, limit, wallet_address)
    create_players_table(connection)

    total_players = 0
    refreshed_player_ids = []
    mfl_wallets = [wallet for wallet in wallets if is_mfl_wallet(wallet["wallet_address"])]
    regular_wallets = [wallet for wallet in wallets if not is_mfl_wallet(wallet["wallet_address"])]

    if workers > 1 and regular_wallets:
        with ThreadPoolExecutor(max_workers=workers) as executor:
            future_to_wallet = {
                executor.submit(fetch_wallet_players, wallet["wallet_address"]): wallet
                for wallet in regular_wallets
            }

            for index, future in enumerate(as_completed(future_to_wallet), start=1):
                wallet = future_to_wallet[future]
                current_wallet_address = wallet["wallet_address"]
                players = future.result()
                player_ids = insert_players(connection, players, current_wallet_address, wallet["wallet_name"])
                connection.commit()

                total_players += len(players)
                refreshed_player_ids.extend(player_ids)
                print(f"{index}/{len(wallets)} {current_wallet_address}: saved {len(players)} players")

    start_index = len(regular_wallets) + 1 if workers > 1 else 1
    sequential_wallets = mfl_wallets if workers > 1 else wallets

    for offset, wallet in enumerate(sequential_wallets, start=0):
        index = start_index + offset
        current_wallet_address = wallet["wallet_address"]

        if is_mfl_wallet(current_wallet_address) and regular_wallets and SLEEP_SECONDS_BEFORE_MFL_WALLET > 0:
            print(f"MFL wallet refresh: waiting {SLEEP_SECONDS_BEFORE_MFL_WALLET:.0f}s before fetching large wallet.")
            time.sleep(SLEEP_SECONDS_BEFORE_MFL_WALLET)

        saved_count, player_ids = save_wallet_players(connection, wallet)

        total_players += saved_count
        refreshed_player_ids.extend(player_ids)
        print(f"{index}/{len(wallets)} {current_wallet_address}: saved {saved_count} players")

        if not is_mfl_wallet(current_wallet_address) and SLEEP_SECONDS_BETWEEN_REQUESTS > 0:
            time.sleep(SLEEP_SECONDS_BETWEEN_REQUESTS)

    refreshed_next = update_next_overall_columns(connection, refreshed_player_ids)
    connection.commit()
    print(f"Next Overall refresh complete: updated {refreshed_next} players.")
    refresh_progressions(connection, refreshed_player_ids, workers)
    return total_players


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Refresh MFL player data from the MFL API.")
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Only refresh this many wallets. Useful for testing.",
    )
    parser.add_argument(
        "--wallet",
        default=None,
        help="Only refresh one wallet address. Useful for testing.",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=100,
        help="Number of wallets/progression batches to fetch at the same time.",
    )
    parser.add_argument(
        "--seasons",
        choices=["yes", "no"],
        default="no",
        help="Use Flow to calculate missing player_seasons after the main refresh.",
    )
    return parser.parse_args()


def format_duration(seconds: float) -> str:
    total_seconds = int(round(seconds))
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)

    if hours:
        return f"{hours}h {minutes}m {seconds}s"
    if minutes:
        return f"{minutes}m {seconds}s"
    return f"{seconds}s"


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(line_buffering=True)
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(line_buffering=True)

    started_at = time.monotonic()
    args = parse_args()

    try:
        with sqlite3.connect(DATABASE_PATH) as connection:
            saved_wallets = refresh_wallets(connection)
            print(f"Wallet refresh complete: saved {saved_wallets} wallets.")
            total_players = refresh_players(connection, args.limit, args.wallet, args.workers)

            if args.seasons == "yes":
                total_seasons = populate_flow_static_fields(
                    connection,
                    args.limit,
                    args.wallet,
                    True,
                    args.workers,
                )
                print(f"Player seasons refresh complete: updated {total_seasons} players.")

        print(f"Player refresh complete: saved {total_players} players.")
        print(f"Database file: {DATABASE_PATH}")
        print(f"Total time: {format_duration(time.monotonic() - started_at)}")
        return 0
    except Exception as error:
        print(f"Player refresh failed: {error}", file=sys.stderr)
        traceback.print_exc()
        print(f"Total time before failure: {format_duration(time.monotonic() - started_at)}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
