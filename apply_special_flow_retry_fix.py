from __future__ import annotations

from pathlib import Path

TARGET = Path(__file__).with_name("populate_seasons_from_flow_original.py")
START_MARKER = "def fetch_wallet_flow_batch_resilient(\n"
END_MARKER = "\n\ndef fetch_wallet_flow_static_players(wallet_address: str) -> list[dict[str, Any]]:\n"

REPLACEMENT = '''def fetch_wallet_flow_batch_resilient(
    wallet_address: str,
    offset: int,
    limit: int,
) -> list[dict[str, Any]]:
    normalized_wallet = wallet_address.lower()
    is_special_wallet = normalized_wallet in {
        MFL_WALLET_ADDRESS,
        MFL_TRADE_WALLET_ADDRESS,
    }

    while True:
        try:
            return parse_flow_static_player_response(
                execute_flow_script(wallet_address, offset, limit)
            )
        except RuntimeError:
            if is_special_wallet:
                print(
                    f"Flow seasons {wallet_address} offset {offset} limit {limit} "
                    f"failed after retries; retrying the same batch in 15s"
                )
                time.sleep(FLOW_RETRY_DELAY_SECONDS)
                continue

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


def main() -> int:
    source = TARGET.read_text(encoding="utf-8")
    start = source.find(START_MARKER)
    end = source.find(END_MARKER)
    if start < 0 or end < 0 or end <= start:
        if "retrying the same batch in 15s" in source:
            print("Special Flow wallet retry behavior is already applied.")
            return 0
        raise RuntimeError("Could not locate Flow resilient batch function")

    updated = source[:start] + REPLACEMENT + source[end:]
    TARGET.write_text(updated, encoding="utf-8")
    print("Updated MFL and MFL Trade Flow retries to keep 3000-player batches.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
