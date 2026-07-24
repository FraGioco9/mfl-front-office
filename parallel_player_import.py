from __future__ import annotations

import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import owner_player_contract_sync

PLAYER_DATA_BATCH_SIZE = 1500


def _fetch_player_range(
    shard_number: int,
    total_shards: int,
    lower_exclusive: int,
    upper_inclusive: int,
) -> list[dict[str, Any]]:
    items: dict[int, dict[str, Any]] = {}
    before_player_id: int | None = upper_inclusive + 1

    while True:
        page = owner_player_contract_sync._request_players_page(
            shard_number,
            before_player_id,
        )
        page_ids = [
            player_id
            for item in page
            if (player_id := owner_player_contract_sync._player_id(item)) is not None
        ]

        for item in page:
            player_id = owner_player_contract_sync._player_id(item)
            if player_id is not None and lower_exclusive < player_id <= upper_inclusive:
                items[player_id] = item

        if not page_ids:
            break

        minimum_page_id = min(page_ids)
        if minimum_page_id <= lower_exclusive or len(page) < owner_player_contract_sync.PAGE_LIMIT:
            break
        if before_player_id is not None and minimum_page_id >= before_player_id:
            raise RuntimeError(
                f"Player data shard {shard_number}/{total_shards} cursor did not move backwards: "
                f"{minimum_page_id} >= {before_player_id}"
            )

        before_player_id = minimum_page_id

    return list(items.values())


def fetch_all_players_parallel(
    highest_player_id: int | None = None,
) -> list[dict[str, Any]]:
    if highest_player_id is None:
        first_page = owner_player_contract_sync._request_players_page(1, None)
        first_page_ids = [
            player_id
            for item in first_page
            if (player_id := owner_player_contract_sync._player_id(item)) is not None
        ]
        if not first_page_ids:
            raise RuntimeError("Player data API first response did not contain player IDs")
        highest_player_id = max(first_page_ids)

    shard_count = max(1, math.ceil(highest_player_id / PLAYER_DATA_BATCH_SIZE))
    ranges: list[tuple[int, int, int]] = []
    for index in range(shard_count):
        lower_exclusive = index * PLAYER_DATA_BATCH_SIZE
        upper_inclusive = min(
            highest_player_id,
            (index + 1) * PLAYER_DATA_BATCH_SIZE,
        )
        if lower_exclusive < upper_inclusive:
            ranges.append((index + 1, lower_exclusive, upper_inclusive))

    ranges.sort(key=lambda value: value[2], reverse=True)
    print(
        f"Pulling player data: {len(ranges)} shards, highest ID {highest_player_id}",
        flush=True,
    )

    players: dict[int, dict[str, Any]] = {}
    with ThreadPoolExecutor(
        max_workers=max(1, len(ranges)),
        thread_name_prefix="mfl-player-data-shard",
    ) as executor:
        futures = {
            executor.submit(
                _fetch_player_range,
                shard_number,
                len(ranges),
                lower_exclusive,
                upper_inclusive,
            ): shard_number
            for shard_number, lower_exclusive, upper_inclusive in ranges
        }

        completed_shards = 0
        for future in as_completed(futures):
            shard_items = future.result()
            for item in shard_items:
                player_id = owner_player_contract_sync._player_id(item)
                if player_id is None:
                    continue
                existing = players.get(player_id)
                if existing is not None and existing != item:
                    raise RuntimeError(
                        f"Player {player_id} was returned with conflicting data by multiple shards"
                    )
                players[player_id] = item
            completed_shards += 1
            print(
                f"Player data shard {completed_shards}/{len(ranges)} succeeded: "
                f"{len(shard_items)} players",
                flush=True,
            )

    if highest_player_id not in players:
        raise RuntimeError(
            f"Player data import did not return highest player ID {highest_player_id}"
        )

    print(f"Player data pulled: {len(players)} players", flush=True)
    return [players[player_id] for player_id in sorted(players, reverse=True)]


def install_parallel_player_import() -> None:
    owner_player_contract_sync.fetch_all_players = fetch_all_players_parallel
