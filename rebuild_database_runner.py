from __future__ import annotations

import os
import sys
import threading
import traceback
from collections.abc import Callable
from typing import Any

import rebuild_database as rebuild
import run_flow_rebuild as pipeline
import run_flow_rebuild_paged as paged


PLAYER_REQUESTS_PER_MINUTE = 80
PROGRESSION_REQUESTS_PER_MINUTE = 80
PROGRESSION_MAX_URL_LENGTH = 5000
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


def progression_url(player_ids: list[int], interval: str) -> str:
    query = pipeline.urlencode(
        {
            "playersIds": ",".join(str(player_id) for player_id in player_ids),
            "interval": interval,
        }
    )
    return f"{pipeline.PROGRESSIONS_URL}?{query}"


def prepare_progression_batches(
    players: list[dict[str, Any]],
    interval: str,
) -> tuple[tuple[int, ...], ...]:
    """Build interval-specific batches whose progression URL stays under 5,000 characters."""
    excluded_wallets = {
        pipeline.MFL_WALLET_ADDRESS.lower(),
        pipeline.MFL_TRADE_WALLET_ADDRESS.lower(),
    }
    eligible_ids = sorted(
        {
            pipeline.player_id(player)
            for player in players
            if paged._owner_wallet_address(player) not in excluded_wallets
        }
    )

    batches: list[tuple[int, ...]] = []
    current: list[int] = []
    for player_id in eligible_ids:
        candidate = [*current, player_id]
        candidate_url_length = len(progression_url(candidate, interval))
        if current and (
            len(candidate) > pipeline.PROGRESSION_BATCH_SIZE
            or candidate_url_length > PROGRESSION_MAX_URL_LENGTH
        ):
            batches.append(tuple(current))
            current = [player_id]
        else:
            current = candidate

        if len(progression_url(current, interval)) > PROGRESSION_MAX_URL_LENGTH:
            raise RuntimeError(
                f"Progression {interval} URL exceeds {PROGRESSION_MAX_URL_LENGTH} characters "
                f"for player {player_id}"
            )

    if current:
        batches.append(tuple(current))

    excluded_count = len(players) - len(eligible_ids)
    longest_url = max(
        (len(progression_url(list(batch), interval)) for batch in batches),
        default=0,
    )
    pipeline.log(
        f"Progression {interval} batches ready: {len(batches)} batches from "
        f"{len(eligible_ids)} players; longest URL {longest_url}/"
        f"{PROGRESSION_MAX_URL_LENGTH} characters; excluded {excluded_count} "
        "MFL/MFL Trade players"
    )
    return tuple(batches)


def configure_rebuild() -> None:
    """Install the authenticated, rate-limited production rebuild configuration."""
    install_mfl_api_authentication()
    pipeline.MFL_REQUESTS_PER_MINUTE = PLAYER_REQUESTS_PER_MINUTE
    pipeline.MFL_WORKERS = 320
    pipeline.RateLimiter = paged.RollingRateLimiter
    pipeline.refresh_wallets = paged.refresh_wallets_without_playmfl_limiter
    paged.prepare_progression_batches = prepare_progression_batches

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
