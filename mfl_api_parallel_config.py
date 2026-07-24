from __future__ import annotations

from functools import wraps
from types import ModuleType
from typing import Any, Callable

import club_contract_rebuild
import flow_data
import leaderboard_rebuild
import owner_player_contract_sync
import progression_rebuild
from mfl_api_rate_limiter import REQUESTS_PER_MINUTE, acquire_mfl_api_slot

MFL_API_WORKERS = 256


def _install_rate_limited_urlopen(module: ModuleType) -> None:
    current = module.urlopen
    if getattr(current, "_mfl_rate_limited", False):
        return

    @wraps(current)
    def rate_limited_urlopen(*args: Any, **kwargs: Any):
        acquire_mfl_api_slot()
        return current(*args, **kwargs)

    rate_limited_urlopen._mfl_rate_limited = True  # type: ignore[attr-defined]
    module.urlopen = rate_limited_urlopen


def install_mfl_api_parallel_config(rebuild_module: ModuleType) -> None:
    for module in (
        owner_player_contract_sync,
        progression_rebuild,
        leaderboard_rebuild,
        club_contract_rebuild,
        flow_data,
    ):
        _install_rate_limited_urlopen(module)

    progression_rebuild.PROGRESSION_WORKERS = MFL_API_WORKERS
    original_refresh_progressions: Callable[..., Any] = rebuild_module.refresh_progressions

    def refresh_progressions_with_max_workers(*args: Any, **kwargs: Any):
        kwargs["workers"] = MFL_API_WORKERS
        return original_refresh_progressions(*args, **kwargs)

    rebuild_module.refresh_progressions = refresh_progressions_with_max_workers

    print(
        f"MFL API concurrency: up to {MFL_API_WORKERS} workers, "
        f"shared cap {REQUESTS_PER_MINUTE} requests/minute",
        flush=True,
    )
