import json
import sqlite3
import sys
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


API_URL = "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/leaderboards/users/global"
DATABASE_PATH = Path(__file__).with_name("mfl_progression.db")
REQUEST_TIMEOUT_SECONDS = 60


def fetch_wallet_data() -> dict[str, Any]:
    request = Request(
        API_URL,
        headers={
            "Accept": "application/json",
            "User-Agent": "mfl-progression-wallet-refresh/1.0",
        },
    )

    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            if response.status != 200:
                raise RuntimeError(f"API returned status code {response.status}")

            response_body = response.read().decode("utf-8")
            data = json.loads(response_body)
    except HTTPError as error:
        raise RuntimeError(f"API request failed with status code {error.code}") from error
    except URLError as error:
        raise RuntimeError(f"Could not connect to the API: {error.reason}") from error
    except json.JSONDecodeError as error:
        raise RuntimeError("API response was not valid JSON") from error

    if not isinstance(data, dict):
        raise RuntimeError("API response was not a JSON object")

    users = data.get("users")
    if not isinstance(users, list):
        raise RuntimeError("API response did not contain a users list")

    return data


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


def to_text(value: Any) -> str:
    if value is None:
        return ""

    return str(value)


def refresh_wallets(connection: sqlite3.Connection, data: dict[str, Any]) -> int:
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

    return saved_count


def main() -> int:
    try:
        data = fetch_wallet_data()

        with sqlite3.connect(DATABASE_PATH) as connection:
            saved_count = refresh_wallets(connection, data)
            connection.commit()

        print(f"Wallet refresh complete: saved {saved_count} wallets.")
        print(f"Database file: {DATABASE_PATH}")
        return 0
    except Exception as error:
        print(f"Wallet refresh failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
