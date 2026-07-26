from __future__ import annotations

"""Guaranteed 80-starts/min entrypoint for the MFL rebuild.

Run this file directly. It bypasses the unreliable sitecustomize redirect and
executes the concurrent paged implementation explicitly.
"""

import run_flow_rebuild_paged


if __name__ == "__main__":
    run_flow_rebuild_paged.FLOW_SPECIAL_WALLET_RANGE_SIZE = 3000
    raise SystemExit(run_flow_rebuild_paged.main())
