from __future__ import annotations

import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import owner_player_contract_sync

ESTIMATED_PLAYER_COUNT = 410_000
PLAYER_DATA_BATCH_SIZE = 1500
PLAYER_IMPORT_SHARDS = math.ceil(ESTIMATED_PLAYER_COUNT / PLAYER_DATA_BATCH_SIZE)
PLAYER_IMPORT_WORKERS = PLAYER_IMPORT_SHARDS


def _fetch_player_range(
    shard_number: int,
    lower_exclusive: int,
    upper_inclusive: int,
    initial_page: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    items: dict[int, dict[str, Any]] = {}
    before_player_id: int | None = upper_inclusive + 1
    request_number = 1
    page = initial_page

    while True:
        if page is None:
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
            if player_id is None:
                continue
            if lower_exclusive < player_id <= upper_inclusive:
                items[player_id] = item

        if not page_ids:
            break

        minimum_page_id = min(page_ids)
        if minimum_page_id <= lower_exclusive:
            break
        if len(page) < owner_player_contract_sync.PAGE_LIMIT:
            break
        if before_player_id is not None and minimum_page_id >= before_player_id:
            raise RuntimeError(
                f"Player data shard {shard_number} cursor did not move backwards: "
                f"{minimum_page_id} >= {before_player_id}"
            )

        before_player_id = minimum_page_id
        request_number += 1
        page = None

    print(
        f"Player data shard {shard_number}/{PLAYER_IMPORT_SHARDS} complete: "
        f"ID range {lower_exclusive + 1}-{upper_inclusive}, "
        f"{len(items)} players pulled in {request_number} request(s)",
        flush=True,
    )
    return list(items.values())


def fetch_all_players_parallel() -> list[dict[str, Any]]:
    first_page = owner_player_contract_sync._request_players_page(1, None)
    first_page_ids = [
        player_id
        for item in first_page
        if (player_id := owner_player_contract_sync._player_id(item)) is not None
    ]
    if not first_page_ids:
        raise RuntimeError("Player data API first response did not contain player IDs")

    highest_player_id = max(first_page_ids)
    shard_count = PLAYER_IMPORT_SHARDS
    shard_width = math.ceil(highest_player_id / shard_count)

    ranges: list[tuple[int, int, int]] = []
    for index in range(shard_count):
        lower_exclusive = index * shard_width
        upper_inclusive = min(highest_player_id, (index + 1) * shard_width)
        if lower_exclusive < upper_inclusive:
            ranges.append((index + 1, lower_exclusive, upper_inclusive))

    ranges.sort(key=lambda value: value[2], reverse=True)
    top_upper = ranges[0][2]
    worker_count = min(PLAYER_IMPORT_WORKERS, len(ranges))
    print(
        f"Player data import started: {len(ranges)} shards, "
        f"up to {worker_count} parallel workers, "
        f"API page limit {owner_player_contract_sync.PAGE_LIMIT}, "
        f"highest player ID {highest_player_id}",
        flush=True,
    )

    players: dict[int, dict[str, Any]] = {}
    with ThreadPoolExecutor(
        max_workers=max(1, worker_count),
        thread_name_prefix="mfl-player-data-shard",
    ) as executor:
        futures = {}
        for shard_number, lower_exclusive, upper_inclusive in ranges:
            seeded_page = first_page if upper_inclusive == top_upper else None
            future = executor.submit(
                _fetch_player_range,
                shard_number,
                lower_exclusive,
                upper_inclusive,
                seeded_page,
            )
            futures[future] = (shard_number, lower_exclusive, upper_inclusive)

        completed = 0
        for future in as_completed(futures):
            shard_number, lower_exclusive, upper_inclusive = futures[future]
            shard_items = future.result()
            for item in shard_items:
                player_id = owner_player_contract_sync._player_id(item)
                if player_id is None:
                    continue
                existing = players.get(player_id)
                if existing is not None and existing != item:
                    raise RuntimeError(
                        f"Player {player_id} was returned with conflicting data by multiple player data shards"
                    )
                players[player_id] = item
            completed += 1
            print(
                f"Player data import progress: {completed}/{len(ranges)} shards complete, "
                f"{len(players)} unique players pulled",
                flush=True,
            )

    if highest_player_id not in players:
        raise RuntimeError(
            f"Player data import did not return highest player ID {highest_player_id}"
        )

    print(
        f"Player data import complete: {len(players)} unique players pulled",
        flush=True,
    )
    return [players[player_id] for player_id in sorted(players, reverse=True)]


def install_parallel_player_import() -> None:
    owner_player_contract_sync.fetch_all_players = fetch_all_players_parallel
