#!/usr/bin/env bash
python - <<'PY'
import json
from pathlib import Path

payload = json.loads(Path("marketplace-output/mfl_marketplace_listings.json").read_text(encoding="utf-8"))
if payload.get("schema_version") != 2:
    raise SystemExit("Marketplace state has an unexpected schema version.")
if payload.get("source") != "flow-mainnet-nftstorefront-events":
    raise SystemExit("Marketplace state has an unexpected source.")
if int(payload.get("flow_block_height", 0)) <= 0:
    raise SystemExit("Marketplace state has no Flow checkpoint.")
if not isinstance(payload.get("active_listings"), dict) or not isinstance(payload.get("players"), dict):
    raise SystemExit("Marketplace state is missing listing/player maps.")
if int(payload.get("listing_count", -1)) != len(payload["active_listings"]):
    raise SystemExit("Marketplace listing count does not match active state.")
print(
    f"Validated {payload['listing_count']} active listings for "
    f"{payload['listed_player_count']} players at Flow block {payload['flow_block_height']} "
    f"using {payload['mode']} mode."
)
PY
