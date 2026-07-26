from __future__ import annotations

from pathlib import Path

TARGET = Path(__file__).with_name("populate_seasons_from_flow_original.py")

OLD_CONSTANT = "MIN_FLOW_SPLIT_BATCH_SIZE = 250\n"
OLD_FUNCTION = '''def fetch_wallet_flow_batch_resilient(
    wallet_address: str,
    offset: int,
    limit: int,
) -> list[dict[str, Any]]:
    try:
        return parse_flow_static_player_response(
            execute_flow_script(wallet_address, offset, limit)
        )
    except RuntimeError:
        if limit <= MIN_FLOW_SPLIT_BATCH_SIZE:
            raise
        left_limit = limit // 2
        right_limit = limit - left_limit
        print(
            f"Flow seasons {wallet_address} offset {offset} limit {limit} failed after retries; "
            f"splitting into {left_limit} and {right_limit}"
        )
        left = fetch_wallet_flow_batch_resilient(wallet_address, offset, left_limit)
        right = fetch_wallet_flow_batch_resilient(
            wallet_address,
            offset + left_limit,
            right_limit,
        )
        return left + right
'''

NEW_FUNCTION = '''def fetch_wallet_flow_batch_resilient(
    wallet_address: str,
    offset: int,
    limit: int,
) -> list[dict[str, Any]]:
    return parse_flow_static_player_response(
        execute_flow_script(wallet_address, offset, limit)
    )
'''


def main() -> int:
    source = TARGET.read_text(encoding="utf-8")

    if OLD_FUNCTION in source:
        source = source.replace(OLD_FUNCTION, NEW_FUNCTION, 1)
    elif NEW_FUNCTION not in source:
        raise RuntimeError(
            "Could not locate the Flow recursive batch-splitting function."
        )

    source = source.replace(OLD_CONSTANT, "", 1)

    if "splitting into" in source:
        raise RuntimeError("Flow batch-splitting logic is still present.")
    if "MIN_FLOW_SPLIT_BATCH_SIZE" in source:
        raise RuntimeError("MIN_FLOW_SPLIT_BATCH_SIZE is still referenced.")

    TARGET.write_text(source, encoding="utf-8")
    print(
        "Updated Flow seasons: every wallet keeps the same 3000-player batch "
        "through retries; recursive splitting is disabled."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
