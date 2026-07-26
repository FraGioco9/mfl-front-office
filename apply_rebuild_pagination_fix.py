from __future__ import annotations

from pathlib import Path

TARGET = Path(__file__).with_name("run_flow_rebuild.py")
START_MARKER = "def page_anchors(first_page: list[dict[str, Any]]) -> list[int]:\n"
END_MARKER = "\n\ndef merge_players(*sources: list[dict[str, Any]]) -> dict[int, dict[str, Any]]:\n"

REPLACEMENT = '''def fetch_paginated_player_source(
    limiter: RateLimiter,
    *,
    label: str,
    retired: bool | None = None,
    wallet_address: str | None = None,
) -> list[dict[str, Any]]:
    players: dict[int, dict[str, Any]] = {}
    before_player_id: int | None = None
    batch_number = 0

    while True:
        page = fetch_players_page(
            limiter,
            page_label=f"{label} batch {batch_number + 1}",
            before_player_id=before_player_id,
            retired=retired,
            wallet_address=wallet_address,
        )
        batch_number += 1
        players.update({player_id(item): item for item in page})
        log(f"{label} batch {batch_number}: returned {len(page)}, total {len(players)}")

        if len(page) < MFL_PAGE_SIZE:
            return list(players.values())

        next_before_player_id = min(player_id(item) for item in page)
        if before_player_id is not None and next_before_player_id >= before_player_id:
            raise RuntimeError(
                f"{label} pagination did not advance: "
                f"{next_before_player_id} >= {before_player_id}"
            )
        before_player_id = next_before_player_id


def fetch_all_player_sources(limiter: RateLimiter) -> dict[str, list[dict[str, Any]]]:
    sources: dict[str, dict[str, Any]] = {
        "general": {"label": "Active players", "retired": False, "wallet": None},
        "retired": {"label": "Retired players", "retired": True, "wallet": None},
        "mfl": {"label": "MFL wallet", "retired": None, "wallet": MFL_WALLET_ADDRESS},
        "mfl_trade": {
            "label": "MFL Trade wallet",
            "retired": None,
            "wallet": MFL_TRADE_WALLET_ADDRESS,
        },
    }

    results: dict[str, list[dict[str, Any]]] = {}
    with ThreadPoolExecutor(max_workers=len(sources)) as executor:
        futures = {
            executor.submit(
                fetch_paginated_player_source,
                limiter,
                label=config["label"],
                retired=config["retired"],
                wallet_address=config["wallet"],
            ): key
            for key, config in sources.items()
        }
        for future in as_completed(futures):
            results[futures[future]] = future.result()

    return results
'''


def main() -> int:
    source = TARGET.read_text(encoding="utf-8")
    start = source.find(START_MARKER)
    end = source.find(END_MARKER)
    if start < 0 or end < 0 or end <= start:
        if "def fetch_paginated_player_source(" in source and "batch {batch_number}:" in source:
            print("run_flow_rebuild.py already uses sequential pagination.")
            return 0
        raise RuntimeError("Could not locate the legacy pagination block in run_flow_rebuild.py")

    updated = source[:start] + REPLACEMENT + source[end:]
    TARGET.write_text(updated, encoding="utf-8")
    print("Updated run_flow_rebuild.py with sequential MFL and MFL Trade pagination.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
