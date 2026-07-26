from __future__ import annotations

"""Guaranteed 80-starts/min entrypoint for the MFL rebuild.

Run this file directly. It bypasses the unreliable sitecustomize redirect and
executes the concurrent paged implementation explicitly.
"""

import run_flow_rebuild_paged


if __name__ == "__main__":
    print(
        "MFL 80 RPM ENTRYPOINT ACTIVE: "
        "run_flow_rebuild_paged.py will enforce 80 starts/min with 320 workers",
        flush=True,
    )
    raise SystemExit(run_flow_rebuild_paged.main())
