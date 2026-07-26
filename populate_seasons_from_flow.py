from __future__ import annotations

import populate_seasons_from_flow_original as _impl

DATABASE_PATH = _impl.DATABASE_PATH
FLOW_SCRIPT_URL = _impl.FLOW_SCRIPT_URL
REQUEST_TIMEOUT_SECONDS = _impl.REQUEST_TIMEOUT_SECONDS
FLOW_REQUESTS_PER_SECOND_LIMIT = _impl.FLOW_REQUESTS_PER_SECOND_LIMIT
MAX_FLOW_REQUEST_RETRIES = _impl.MAX_FLOW_REQUEST_RETRIES
FLOW_RETRY_STATUS_CODES = _impl.FLOW_RETRY_STATUS_CODES
FLOW_RETRY_ERROR_MARKERS = _impl.FLOW_RETRY_ERROR_MARKERS
MFL_WALLET_ADDRESS = _impl.MFL_WALLET_ADDRESS
MFL_TRADE_WALLET_ADDRESS = _impl.MFL_TRADE_WALLET_ADDRESS
FLOW_RETRY_DELAY_SECONDS = _impl.FLOW_RETRY_DELAY_SECONDS
FLOW_STATIC_PLAYER_BATCH_SIZE = 500
MIN_FLOW_SPLIT_BATCH_SIZE = _impl.MIN_FLOW_SPLIT_BATCH_SIZE
FLOW_WORKERS = _impl.FLOW_WORKERS


def populate_flow_static_fields(connection, limit, wallet_address, force, include_mfl_wallet=True):
    _impl.SPECIAL_API_WALLETS = set()
    _impl.FLOW_STATIC_PLAYER_BATCH_SIZE = min(int(FLOW_STATIC_PLAYER_BATCH_SIZE), 500)
    _impl.FLOW_WORKERS = int(FLOW_WORKERS)
    _impl.FLOW_RETRY_DELAY_SECONDS = float(FLOW_RETRY_DELAY_SECONDS)
    return _impl.populate_flow_static_fields(
        connection,
        limit,
        wallet_address,
        force,
        include_mfl_wallet,
    )


def main() -> int:
    return _impl.main()


if __name__ == "__main__":
    raise SystemExit(main())
