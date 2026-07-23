from __future__ import annotations

import re
from types import ModuleType
from typing import Any

SPORK_ROOT_PATTERN = re.compile(r"spork root block height\s+(\d+)", re.IGNORECASE)


def extract_spork_root_height(error: BaseException | str) -> int | None:
    match = SPORK_ROOT_PATTERN.search(str(error))
    if not match:
        return None
    height = int(match.group(1))
    return height if height >= 0 else None


def install_spork_ownership_hook(rebuild_module: ModuleType) -> None:
    original_replay = rebuild_module.replay_ownership_deposits
    original_validate = rebuild_module.validate_database
    replay_state: dict[str, Any] = {
        "fallback_used": False,
        "requested_start_height": None,
        "effective_start_height": None,
        "spork_root_height": None,
    }

    replay_globals = getattr(original_replay, "__globals__", None)
    original_fetch_range = (
        replay_globals.get("_fetch_deposit_range")
        if isinstance(replay_globals, dict)
        else None
    )
    if callable(original_fetch_range) and not getattr(
        original_fetch_range,
        "_flow_progress_wrapper",
        False,
    ):
        def fetch_deposit_range_with_progress(start_height: int, end_height: int):
            print(
                f"Fetching Flow ownership events: blocks {start_height}-{end_height}",
                flush=True,
            )
            return original_fetch_range(start_height, end_height)

        setattr(fetch_deposit_range_with_progress, "_flow_progress_wrapper", True)
        replay_globals["_fetch_deposit_range"] = fetch_deposit_range_with_progress

    def replay_ownership_deposits(
        ownership: dict[int, str],
        *,
        start_height: int,
        end_height: int,
        window_size: int = 1_000_000,
    ):
        replay_state["requested_start_height"] = start_height
        replay_state["effective_start_height"] = start_height
        try:
            return original_replay(
                ownership,
                start_height=start_height,
                end_height=end_height,
                window_size=window_size,
            )
        except Exception as error:
            spork_root = extract_spork_root_height(error)
            if spork_root is None or start_height >= spork_root:
                raise

            replay_state["fallback_used"] = True
            replay_state["effective_start_height"] = spork_root
            replay_state["spork_root_height"] = spork_root
            return original_replay(
                ownership,
                start_height=spork_root,
                end_height=end_height,
                window_size=window_size,
            )

    def validate_database(*args, **kwargs):
        fallback_used = bool(replay_state["fallback_used"])
        if fallback_used:
            kwargs["require_full_ownership_coverage"] = False

        report = original_validate(*args, **kwargs)
        report["ownership_requested_start_height"] = replay_state["requested_start_height"]
        report["ownership_effective_start_height"] = replay_state["effective_start_height"]
        report["ownership_spork_root_height"] = replay_state["spork_root_height"]
        report["ownership_spork_fallback_used"] = fallback_used
        report["ownership_seeded_from_previous_database"] = fallback_used

        warnings = list(report.get("warnings") or [])
        if fallback_used:
            warnings.append(
                "The current Flow access node does not expose pre-spork events. "
                "Ownership before the spork root was preserved from the previous database, "
                "and Flow deposits were replayed from the spork root onward."
            )
        report["warnings"] = warnings
        return report

    rebuild_module.replay_ownership_deposits = replay_ownership_deposits
    rebuild_module.validate_database = validate_database
