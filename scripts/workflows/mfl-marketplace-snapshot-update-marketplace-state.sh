#!/usr/bin/env bash
set -euo pipefail
WORKERS="${MARKETPLACE_WORKERS:-20}"
if [ "$MODE" = "incremental" ]; then
  python -m scripts.marketplace.mfl_marketplace_events \
    --mode incremental \
    --previous-state marketplace-previous/mfl_marketplace_listings.json \
    --output marketplace-output/mfl_marketplace_listings.json
else
  python -m scripts.marketplace.mfl_marketplace_events \
    --mode "$MODE" \
    --database marketplace-database/mfl_database.db \
    --output marketplace-output/mfl_marketplace_listings.json \
    --workers "$WORKERS"
fi
