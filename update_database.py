import argparse
import json
import sqlite3
import sys
import time
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
API_LIMIT = 1500
PROGRESSION_BATCH_SIZE = 1000
REQUEST_TIMEOUT_SECONDS = 60
SLEEP_SECONDS_BETWEEN_REQUESTS = 0.15
MAX_REQUEST_RETRIES = 3
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
            age_at_mint INTEGER,
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
            goalkeeping_prog_current_season INTEGER
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

    recreate_wallet_table(connection)

    for user in users:
        if not isinstance(user, dict):
            continue

        wallet_address = to_text(user.get("walletAddress")).strip().lower()
        if not wallet_address:
            continue

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
                to_text(user.get("name")),
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
        "age_at_mint": "INTEGER",
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
    }

    if "seasons" in existing_columns and "player_seasons" not in existing_columns:
        connection.execute("ALTER TABLE players RENAME COLUMN seasons TO player_seasons")
        existing_columns.remove("seasons")
        existing_columns.add("player_seasons")

    for column_name, column_type in expected_columns.items():
        if column_name not in existing_columns:
            connection.execute(f"ALTER TABLE players ADD COLUMN {column_name} {column_type}")

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

    return [{"wallet_address": row[0], "wallet_name": row[1]} for row in rows]


def fetch_players_page(wallet_address: str, before_player_id: int | None) -> list[dict[str, Any]]:
    query = {
        "limit": API_LIMIT,
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
        data = fetch_json_with_retries(request, "MFL players API")
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
) -> Any:
    for attempt in range(MAX_REQUEST_RETRIES + 1):
        try:
            with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            if error.code == 414 and too_large_message is not None:
                raise ProgressionRequestTooLargeError(too_large_message) from error

            if error.code not in RETRY_STATUS_CODES or attempt == MAX_REQUEST_RETRIES:
                raise RuntimeError(f"{api_name} returned status code {error.code}") from error

            sleep_seconds = retry_delay_seconds(attempt)
            print(
                f"{api_name} returned {error.code}; retrying in {sleep_seconds:.1f}s "
                f"({attempt + 1}/{MAX_REQUEST_RETRIES})"
            )
            time.sleep(sleep_seconds)
        except URLError:
            if attempt == MAX_REQUEST_RETRIES:
                raise

            sleep_seconds = retry_delay_seconds(attempt)
            print(
                f"{api_name} connection failed; retrying in {sleep_seconds:.1f}s "
                f"({attempt + 1}/{MAX_REQUEST_RETRIES})"
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

    while True:
        page = fetch_players_page(wallet_address, before_player_id)

        if not page:
            break

        for player in page:
            player_id = player.get("id")

            if player_id in seen_player_ids:
                continue

            seen_player_ids.add(player_id)
            all_players.append(player)

        if len(page) < API_LIMIT:
            break

        next_before_player_id = page[-1].get("id")
        if next_before_player_id is None or next_before_player_id == before_player_id:
            break

        before_player_id = int(next_before_player_id)
        time.sleep(SLEEP_SECONDS_BETWEEN_REQUESTS)

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
                None,
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
            goalkeeping,
            player_seasons
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            goalkeeping = excluded.goalkeeping,
            player_seasons = CASE
                WHEN players.age_at_mint IS NOT NULL AND excluded.age IS NOT NULL THEN excluded.age - players.age_at_mint + 1
                ELSE players.player_seasons
            END
        """,
        rows,
    )
    return player_ids


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
            batch,
        ).fetchall()
        required_ids.extend(row[0] for row in rows)

    return required_ids


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

    if workers > 1:
        with ThreadPoolExecutor(max_workers=workers) as executor:
            future_to_wallet = {
                executor.submit(fetch_wallet_players, wallet["wallet_address"]): wallet
                for wallet in wallets
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

        refresh_progressions(connection, refreshed_player_ids, workers)
        return total_players

    for index, wallet in enumerate(wallets, start=1):
        current_wallet_address = wallet["wallet_address"]
        players = fetch_wallet_players(current_wallet_address)
        player_ids = insert_players(connection, players, current_wallet_address, wallet["wallet_name"])
        connection.commit()

        total_players += len(players)
        refreshed_player_ids.extend(player_ids)
        print(f"{index}/{len(wallets)} {current_wallet_address}: saved {len(players)} players")

        if SLEEP_SECONDS_BETWEEN_REQUESTS > 0:
            time.sleep(SLEEP_SECONDS_BETWEEN_REQUESTS)

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
        help="Use Flow to populate missing age_at_mint values and calculate player_seasons after the main refresh.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        with sqlite3.connect(DATABASE_PATH) as connection:
            saved_wallets = refresh_wallets(connection)
            print(f"Wallet refresh complete: saved {saved_wallets} wallets.")
            total_players = refresh_players(connection, args.limit, args.wallet, args.workers)

            if args.seasons == "yes":
                total_seasons = populate_flow_static_fields(connection, args.limit, args.wallet, False)
                print(f"Player seasons refresh complete: updated {total_seasons} players.")

        print(f"Player refresh complete: saved {total_players} players.")
        print(f"Database file: {DATABASE_PATH}")
        return 0
    except Exception as error:
        print(f"Player refresh failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
