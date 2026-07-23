from __future__ import annotations

import json
import sqlite3
import time
from types import ModuleType
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

LEADERBOARD_API_URL = "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/leaderboards/users/global"
MFL_WALLET_ADDRESS = "0xff8d2bbed8164db0"
REQUEST_TIMEOUT_SECONDS = 60
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 60.0
RETRY_STATUS_CODES = {403, 429, 500, 502, 503, 504}


def fetch_leaderboard_wallet_names() -> dict[str, str]:
    request = Request(
        LEADERBOARD_API_URL,
        headers={
            "Accept": "application/json",
            "User-Agent": "mfl-front-office-flow-rebuild/1.0",
        },
    )

    for attempt in range(MAX_RETRIES + 1):
        try:
            with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                data = json.loads(response.read().decode("utf-8"))
            break
        except HTTPError as error:
            if error.code not in RETRY_STATUS_CODES or attempt == MAX_RETRIES:
                raise RuntimeError(f"MFL leaderboard API returned status code {error.code}") from error
            print(
                f"MFL leaderboard API returned {error.code}; retrying in "
                f"{RETRY_DELAY_SECONDS:.0f}s ({attempt + 1}/{MAX_RETRIES})",
                flush=True,
            )
            time.sleep(RETRY_DELAY_SECONDS)
        except (URLError, TimeoutError) as error:
            if attempt == MAX_RETRIES:
                reason = getattr(error, "reason", str(error))
                raise RuntimeError(f"Could not connect to MFL leaderboard API: {reason}") from error
            print(
                f"MFL leaderboard API connection failed; retrying in "
                f"{RETRY_DELAY_SECONDS:.0f}s ({attempt + 1}/{MAX_RETRIES})",
                flush=True,
            )
            time.sleep(RETRY_DELAY_SECONDS)
        except json.JSONDecodeError as error:
            raise RuntimeError("MFL leaderboard API response was not valid JSON") from error
    else:
        raise RuntimeError("MFL leaderboard API request failed after retries")

    if not isinstance(data, dict) or not isinstance(data.get("users"), list):
        raise RuntimeError("MFL leaderboard API response did not contain a users list")

    names: dict[str, str] = {}
    for user in data["users"]:
        if not isinstance(user, dict):
            continue
        address = str(user.get("walletAddress") or "").strip().lower()
        if not address:
            continue
        name = str(user.get("name") or "").strip()
        if name or address not in names:
            names[address] = name

    names[MFL_WALLET_ADDRESS] = "MFL"
    return names


def merge_wallet_names(
    leaderboard_names: dict[str, str],
    previous_names: dict[str, str],
) -> dict[str, str]:
    merged = {
        str(address).lower(): str(name or "")
        for address, name in previous_names.items()
        if address
    }
    for address, name in leaderboard_names.items():
        normalized = str(address or "").lower()
        if not normalized:
            continue
        normalized_name = str(name or "")
        if normalized_name or normalized not in merged:
            merged[normalized] = normalized_name
    return merged


def rebuild_wallet_table(
    connection: sqlite3.Connection,
    leaderboard_names: dict[str, str],
    known_names: dict[str, str],
) -> None:
    connection.execute("DROP TABLE IF EXISTS wallets")
    connection.execute(
        """
        CREATE TABLE wallets (
            wallet_address TEXT PRIMARY KEY,
            name TEXT NOT NULL DEFAULT ''
        )
        """
    )

    owner_addresses = {
        str(row[0] or "").lower()
        for row in connection.execute("SELECT DISTINCT wallet_address FROM players")
        if row[0]
    }
    addresses = sorted(set(leaderboard_names) | owner_addresses)
    connection.executemany(
        "INSERT INTO wallets(wallet_address, name) VALUES (?, ?)",
        [
            (
                address,
                leaderboard_names.get(address)
                or known_names.get(address)
                or address,
            )
            for address in addresses
        ],
    )
    connection.commit()


def install_leaderboard_hooks(
    rebuild_module: ModuleType,
    leaderboard_names: dict[str, str],
) -> None:
    original_previous_wallet_names = rebuild_module.previous_wallet_names
    original_validate_database = rebuild_module.validate_database

    def previous_wallet_names(connection: sqlite3.Connection) -> dict[str, str]:
        previous_names = original_previous_wallet_names(connection)
        return merge_wallet_names(leaderboard_names, previous_names)

    def rebuild_wallets(
        connection: sqlite3.Connection,
        known_names: dict[str, str],
    ) -> None:
        rebuild_wallet_table(connection, leaderboard_names, known_names)

    def validate_database(*args: Any, **kwargs: Any) -> dict[str, Any]:
        report = original_validate_database(*args, **kwargs)
        connection = args[0] if args else kwargs["connection"]
        wallet_count = int(connection.execute("SELECT COUNT(*) FROM wallets").fetchone()[0])
        placeholders = ",".join("?" for _ in leaderboard_names)
        if leaderboard_names:
            imported_count = int(
                connection.execute(
                    f"SELECT COUNT(*) FROM wallets WHERE lower(wallet_address) IN ({placeholders})",
                    list(leaderboard_names),
                ).fetchone()[0]
            )
        else:
            imported_count = 0

        missing_leaderboard_wallets = len(leaderboard_names) - imported_count
        errors = list(report.get("errors") or [])
        if missing_leaderboard_wallets:
            errors.append(f"{missing_leaderboard_wallets} leaderboard wallets are missing from wallets")

        report.update(
            {
                "wallet_count": wallet_count,
                "leaderboard_wallet_count": len(leaderboard_names),
                "imported_leaderboard_wallet_count": imported_count,
                "missing_leaderboard_wallets": missing_leaderboard_wallets,
                "errors": errors,
                "valid": not errors,
            }
        )
        return report

    rebuild_module.previous_wallet_names = previous_wallet_names
    rebuild_module.rebuild_wallets = rebuild_wallets
    rebuild_module.validate_database = validate_database
