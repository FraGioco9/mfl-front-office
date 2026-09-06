from __future__ import annotations

import os
import sys
import threading
import traceback
from collections.abc import Callable
from typing import Any

from scripts.database import rebuild_database as rebuild
from scripts.database import run_flow_rebuild as pipeline
from scripts.database import run_flow_rebuild_paged as paged
PLAYER_REQUESTS_PER_MINUTE = 80
PROGRESSION_REQUESTS_PER_MINUTE = 80
MFL_API_TOKEN_ENVIRONMENT_VARIABLE = "MFL_API_TOKEN"


def install_mfl_api_authentication() -> None:
    """Configure the canonical rebuild HTTP owner with the production MFL API token."""
    token = os.environ.get(MFL_API_TOKEN_ENVIRONMENT_VARIABLE, "").strip()
    if not token:
        raise RuntimeError(
            f"{MFL_API_TOKEN_ENVIRONMENT_VARIABLE} is required for database rebuilds"
        )
    pipeline.configure_mfl_api_token(token)


def print_failure(stage: str, error: BaseException) -> None:
    print(
        f"[ERROR] {stage} failed: {type(error).__name__}: {error}",
        file=sys.stderr,
        flush=True,
    )
    traceback.print_exc(file=sys.stderr)


def run_with_error_logging(stage: str, operation: Callable[[], Any]) -> Any:
    try:
        return operation()
    except Exception as error:
        print_failure(stage, error)
        raise


def install_thread_error_logging() -> None:
    def report_thread_failure(args: threading.ExceptHookArgs) -> None:
        print(
            f"[ERROR] Worker thread {args.thread.name} failed: "
            f"{args.exc_type.__name__}: {args.exc_value}",
            file=sys.stderr,
            flush=True,
        )
        traceback.print_exception(
            args.exc_type,
            args.exc_value,
            args.exc_traceback,
            file=sys.stderr,
        )

    threading.excepthook = report_thread_failure


def configure_rebuild() -> None:
    """Install the authenticated, rate-limited production rebuild configuration."""
    install_mfl_api_authentication()
    pipeline.MFL_REQUESTS_PER_MINUTE = PLAYER_REQUESTS_PER_MINUTE
    pipeline.MFL_WORKERS = 320
    pipeline.RateLimiter = paged.RollingRateLimiter
    pipeline.refresh_wallets = paged.refresh_wallets_without_playmfl_limiter

    configured_player_fetcher = rebuild.fetch_active_and_retired_player_sources

    def fetch_players_with_logging(limiter: paged.RollingRateLimiter) -> Any:
        return run_with_error_logging(
            "/players",
            lambda: paged.fetch_player_sources_and_prepare_progressions(
                configured_player_fetcher,
                limiter,
            ),
        )

    def refresh_progressions_with_own_limiter(
        connection: object,
        _player_limiter: paged.RollingRateLimiter,
    ) -> dict[str, int]:
        progression_limiter = paged.RollingRateLimiter(
            PROGRESSION_REQUESTS_PER_MINUTE
        )
        return run_with_error_logging(
            "/players/progressions",
            lambda: paged.refresh_progressions_from_prepared_batches(
                connection,
                progression_limiter,
            ),
        )

    pipeline.fetch_all_player_sources = fetch_players_with_logging
    pipeline.refresh_progressions = refresh_progressions_with_own_limiter

    rebuild.install_database_filename()
    rebuild.install_concise_progression_logging()
    rebuild.install_flow_wallet_id_cache()

    pipeline.log(
        "PlayMFL runtime configuration: "
        f"/players {PLAYER_REQUESTS_PER_MINUTE} starts/min, "
        f"/players/progressions {PROGRESSION_REQUESTS_PER_MINUTE} starts/min, "
        f"{pipeline.MFL_WORKERS} workers"
    )


def main() -> int:
    install_thread_error_logging()
    try:
        configure_rebuild()
        return rebuild.rebuild_directly()
    except Exception as error:
        print_failure("Database rebuild", error)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
