from __future__ import annotations

import traceback

import rebuild_database as rebuild
import run_flow_rebuild as pipeline
import run_flow_rebuild_paged as paged


PLAYER_REQUESTS_PER_MINUTE = 80
PROGRESSION_REQUESTS_PER_MINUTE = 40


def configure_rebuild() -> None:
    """Install the permanent player/progression rate limits for the database rebuild."""
    pipeline.MFL_REQUESTS_PER_MINUTE = PLAYER_REQUESTS_PER_MINUTE
    pipeline.MFL_WORKERS = 320
    pipeline.RateLimiter = paged.RollingRateLimiter
    pipeline.refresh_wallets = paged.refresh_wallets_without_playmfl_limiter

    configured_player_fetcher = rebuild.fetch_active_and_retired_player_sources
    pipeline.fetch_all_player_sources = lambda limiter: (
        paged.fetch_player_sources_and_prepare_progressions(
            configured_player_fetcher,
            limiter,
        )
    )

    def refresh_progressions_with_own_limiter(
        connection: object,
        _player_limiter: paged.RollingRateLimiter,
    ) -> dict[str, int]:
        progression_limiter = paged.RollingRateLimiter(
            PROGRESSION_REQUESTS_PER_MINUTE
        )
        return paged.refresh_progressions_from_prepared_batches(
            connection,
            progression_limiter,
        )

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
    configure_rebuild()
    try:
        return rebuild.rebuild_directly()
    except Exception as error:
        pipeline.log(
            f"Database rebuild failed: {type(error).__name__}: {error}"
        )
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
