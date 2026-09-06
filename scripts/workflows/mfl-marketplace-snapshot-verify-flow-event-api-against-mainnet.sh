#!/usr/bin/env bash
python - <<'PY'
from scripts.marketplace.mfl_marketplace_events import fetch_marketplace_events
from scripts.marketplace.mfl_marketplace_snapshot import fetch_sealed_block_height

end = fetch_sealed_block_height()
start = max(1, end - 249)
events = fetch_marketplace_events(start, end)
print(f"Flow event API smoke test succeeded for blocks {start}-{end}: {len(events)} Storefront events.")
PY
