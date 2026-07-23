from __future__ import annotations

from types import ModuleType
from typing import Any
from urllib.request import Request

from flow_data import FLOW_ACCESS_NODE, FlowRequestError, _request_json


def _positive_height(value: Any) -> int | None:
    try:
        height = int(value)
    except (TypeError, ValueError):
        return None
    return height if height >= 0 else None


def extract_latest_block_height(data: Any) -> int:
    if isinstance(data, list):
        blocks = data
    elif isinstance(data, dict) and isinstance(data.get("blocks"), list):
        blocks = data["blocks"]
    elif isinstance(data, dict):
        blocks = [data]
    else:
        blocks = []

    for block in blocks:
        if not isinstance(block, dict):
            continue

        nested_block = block.get("block") if isinstance(block.get("block"), dict) else {}
        candidates = [
            block.get("height"),
            (block.get("header") or {}).get("height") if isinstance(block.get("header"), dict) else None,
            (block.get("block_header") or {}).get("height") if isinstance(block.get("block_header"), dict) else None,
            nested_block.get("height"),
            (nested_block.get("header") or {}).get("height")
            if isinstance(nested_block.get("header"), dict)
            else None,
        ]

        for candidate in candidates:
            height = _positive_height(candidate)
            if height is not None:
                return height

    raise FlowRequestError("Latest sealed block response did not contain a supported height field")


def get_latest_sealed_block_height() -> int:
    request = Request(
        f"{FLOW_ACCESS_NODE}/v1/blocks?height=sealed",
        headers={
            "Accept": "application/json",
            "User-Agent": "mfl-front-office-flow-rebuild/1.0",
        },
    )
    data = _request_json(request, "Latest sealed block request")
    return extract_latest_block_height(data)


def install_block_height_hook(rebuild_module: ModuleType) -> None:
    rebuild_module.get_latest_sealed_block_height = get_latest_sealed_block_height
