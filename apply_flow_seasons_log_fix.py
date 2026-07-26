from __future__ import annotations

from pathlib import Path

TARGET = Path(__file__).with_name("populate_seasons_from_flow_original.py")

OLD_BATCH_LOG = '''        batch_number += 1
        print(
            f"Flow seasons {wallet_address} batch {batch_number}: "
            f"read {FLOW_STATIC_PLAYER_BATCH_SIZE} IDs, returned {len(batch)}, "
            f"total {len(players)}"
        )
'''
NEW_BATCH_LOG = '''        batch_number += 1
'''

OLD_WALLET_LOG = '''            completed += 1
            print(
                f"Flow seasons wallet {completed}/{len(flow_wallets)} "
                f"{wallet}: updated {updated}"
            )
'''
NEW_WALLET_LOG = '''            completed += 1
            if completed % 25 == 0 or completed == len(flow_wallets):
                print(f"Flow seasons wallet {completed}/{len(flow_wallets)}")
'''


def main() -> int:
    source = TARGET.read_text(encoding="utf-8")

    if OLD_BATCH_LOG in source:
        source = source.replace(OLD_BATCH_LOG, NEW_BATCH_LOG, 1)
    elif "read {FLOW_STATIC_PLAYER_BATCH_SIZE} IDs" in source:
        raise RuntimeError("Flow batch log exists but did not match the expected block")

    if OLD_WALLET_LOG in source:
        source = source.replace(OLD_WALLET_LOG, NEW_WALLET_LOG, 1)
    elif 'print(f"Flow seasons wallet {completed}/{len(flow_wallets)}")' not in source:
        raise RuntimeError("Flow wallet progress log did not match the expected block")

    TARGET.write_text(source, encoding="utf-8")
    print("Flow seasons logging updated: one progress message every 25 wallets.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
