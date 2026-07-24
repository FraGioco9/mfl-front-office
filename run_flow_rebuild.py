from __future__ import annotations

import json
import sqlite3
from typing import Any
from urllib.request import Request, urlopen

import fresh_mfl_database_rebuild as rebuild


FLOW_BLOCKS_URL = "https://rest-mainnet.onflow.org/v1/blocks?height=sealed"


def insert_wallets_without_row_logs(
    connection: sqlite3.Connection,
    names: dict[str, str],
) -> None:
    connection.executemany(
        "INSERT INTO wallets(wallet_address, wallet_name) VALUES (?, ?)",
        sorted(names.items()),
    )
    connection.commit()


def _find_block_height(value: Any) -> int | None:
    if isinstance(value, dict):
        for key in ("height", "block_height", "blockHeight"):
            raw_height = value.get(key)
            if raw_height not in (None, ""):
                try:
                    return int(raw_height)
                except (TypeError, ValueError):
                    pass

        for key in ("header", "block_header", "blockHeader", "block"):
            if key in value:
                height = _find_block_height(value[key])
                if height is not None:
                    return height

        for child in value.values():
            height = _find_block_height(child)
            if height is not None:
                return height

    elif isinstance(value, list):
        for child in value:
            height = _find_block_height(child)
            if height is not None:
                return height

    return None


def get_latest_sealed_block_height() -> int:
    request = Request(
        FLOW_BLOCKS_URL,
        headers={
            "Accept": "application/json",
            "User-Agent": "mfl-front-office-clean-rebuild/1.0",
        },
    )
    with urlopen(request, timeout=rebuild.REQUEST_TIMEOUT) as response:
        data = json.loads(response.read().decode("utf-8"))

    height = _find_block_height(data)
    if height is None or height <= 0:
        preview = json.dumps(data, separators=(",", ":"))[:500]
        raise RuntimeError(
            "Latest sealed block response did not contain a valid height. "
            f"Response preview: {preview}"
        )
    return height


def fetch_leaderboard_without_item_logs():
    original_log = rebuild.log

    def filtered_log(message: str) -> None:
        if message.startswith("Leaderboard wallet "):
            return
        original_log(message)

    rebuild.log = filtered_log
    try:
        return original_fetch_leaderboard()
    finally:
        rebuild.log = original_log


original_fetch_leaderboard = rebuild.fetch_leaderboard
rebuild.insert_wallets = insert_wallets_without_row_logs
rebuild.fetch_leaderboard = fetch_leaderboard_without_item_logs
rebuild.get_latest_sealed_block_height = get_latest_sealed_block_height


if __name__ == "__main__":
    raise SystemExit(rebuild.main())
