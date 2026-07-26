from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import run_flow_rebuild as pipeline


def fetch_paginated_source(
    limiter: pipeline.RateLimiter,
    *,
    label: str,
    retired: bool | None = None,
    wallet_address: str | None = None,
) -> list[dict[str, Any]]:
    players: dict[int, dict[str, Any]] = {}
    before_player_id: int | None = None
    batch_number = 0

    while True:
        page = pipeline.fetch_players_page(
            limiter,
            page_label=f"{label} batch {batch_number + 1}",
            before_player_id=before_player_id,
            retired=retired,
            wallet_address=wallet_address,
        )
        batch_number += 1

        for player in page:
            players[pipeline.player_id(player)] = player

        pipeline.log(
            f"{label} batch {batch_number}: returned {len(page)}, "
            f"total {len(players)}"
        )

        if len(page) < pipeline.MFL_PAGE_SIZE:
            break

        next_before_player_id = min(pipeline.player_id(player) for player in page)
        if (
            before_player_id is not None
            and next_before_player_id >= before_player_id
        ):
            raise RuntimeError(
                f"{label} pagination did not advance: "
                f"{next_before_player_id} >= {before_player_id}"
            )
        before_player_id = next_before_player_id

    return list(players.values())


def fetch_all_player_sources(
    limiter: pipeline.RateLimiter,
) -> dict[str, list[dict[str, Any]]]:
    sources: dict[str, dict[str, Any]] = {
        "general": {
            "label": "Active players",
            "retired": False,
            "wallet_address": None,
        },
        "retired": {
            "label": "Retired players",
            "retired": True,
            "wallet_address": None,
        },
        "mfl": {
            "label": "MFL wallet",
            "retired": None,
            "wallet_address": pipeline.MFL_WALLET_ADDRESS,
        },
        "mfl_trade": {
            "label": "MFL Trade wallet",
            "retired": None,
            "wallet_address": pipeline.MFL_TRADE_WALLET_ADDRESS,
        },
    }

    results: dict[str, list[dict[str, Any]]] = {}
    with ThreadPoolExecutor(max_workers=len(sources)) as executor:
        futures = {
            executor.submit(
                fetch_paginated_source,
                limiter,
                label=config["label"],
                retired=config["retired"],
                wallet_address=config["wallet_address"],
            ): key
            for key, config in sources.items()
        }
        for future in as_completed(futures):
            key = futures[future]
            results[key] = future.result()

    return results


def main() -> int:
    pipeline.fetch_all_player_sources = fetch_all_player_sources
    return pipeline.main()


if __name__ == "__main__":
    raise SystemExit(main())
