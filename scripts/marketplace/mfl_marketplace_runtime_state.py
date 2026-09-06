from __future__ import annotations

import argparse
import json
import os
from decimal import Decimal, InvalidOperation
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

RUNTIME_BUCKET = "mfl-runtime"
RUNTIME_OBJECT = "marketplace/listings.json"
REQUEST_TIMEOUT_SECONDS = 30


def runtime_payload(snapshot: dict[str, object]) -> dict[str, object]:
    players = snapshot.get("players")
    generated_at = str(snapshot.get("generated_at") or "").strip()
    if not isinstance(players, dict) or not generated_at:
        raise ValueError("Marketplace snapshot is missing players or generated_at")

    prices: dict[str, str] = {}
    for player_id, player in players.items():
        if not isinstance(player, dict):
            continue
        try:
            normalized_id = str(int(str(player_id)))
            price = Decimal(str(player.get("listing_price")))
        except (TypeError, ValueError, InvalidOperation):
            continue
        if int(normalized_id) <= 0 or not price.is_finite() or price < 0:
            continue
        prices[normalized_id] = format(price, "f")

    return {
        "schema_version": 1,
        "generated_at": generated_at,
        "source": str(snapshot.get("source") or ""),
        "flow_block_height": int(snapshot.get("flow_block_height") or 0),
        "listed_player_count": len(prices),
        "prices": prices,
    }


def request_headers(service_role_key: str, *, content_type: str = "application/json") -> dict[str, str]:
    return {
        "Authorization": f"Bearer {service_role_key}",
        "apikey": service_role_key,
        "Content-Type": content_type,
    }


def ensure_bucket(supabase_url: str, service_role_key: str) -> None:
    request = Request(
        f"{supabase_url.rstrip('/')}/storage/v1/bucket",
        data=json.dumps(
            {
                "id": RUNTIME_BUCKET,
                "name": RUNTIME_BUCKET,
                "public": False,
            },
            separators=(",", ":"),
        ).encode("utf-8"),
        headers=request_headers(service_role_key),
        method="POST",
    )
    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS):
            return
    except HTTPError as error:
        if error.code in {400, 409}:
            return
        raise


def publish_runtime_payload(
    payload: dict[str, object],
    *,
    supabase_url: str,
    service_role_key: str,
) -> None:
    if not supabase_url or not service_role_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    ensure_bucket(supabase_url, service_role_key)
    object_path = "/".join(quote(part, safe="") for part in RUNTIME_OBJECT.split("/"))
    body = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    request = Request(
        f"{supabase_url.rstrip('/')}/storage/v1/object/{RUNTIME_BUCKET}/{object_path}",
        data=body,
        headers={
            **request_headers(service_role_key),
            "x-upsert": "true",
            "cache-control": "no-cache",
        },
        method="POST",
    )
    with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS):
        return


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Publish the current MFL marketplace listing-price map for the site runtime."
    )
    parser.add_argument("--input", required=True, type=Path)
    args = parser.parse_args()

    snapshot = json.loads(args.input.read_text(encoding="utf-8"))
    if not isinstance(snapshot, dict):
        raise SystemExit("Marketplace snapshot must be a JSON object")
    payload = runtime_payload(snapshot)
    publish_runtime_payload(
        payload,
        supabase_url=str(os.environ.get("SUPABASE_URL") or "").strip(),
        service_role_key=str(os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip(),
    )
    print(
        f"Published {payload['listed_player_count']} marketplace prices from "
        f"Flow block {payload['flow_block_height']} to {RUNTIME_BUCKET}/{RUNTIME_OBJECT}."
    )


if __name__ == "__main__":
    main()
