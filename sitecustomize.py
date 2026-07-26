"""Project-local Python startup hooks.

Redirect the legacy Flow rebuild entry point to the paged implementation so
`python run_flow_rebuild.py` uses sequential PlayMFL pagination for MFL and
MFL Trade instead of pre-calculating speculative page anchors.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


LEGACY_ENTRYPOINT = "run_flow_rebuild.py"
PAGED_ENTRYPOINT = "run_flow_rebuild_paged.py"
REDIRECT_GUARD = "MFL_FLOW_REBUILD_PAGED_REDIRECT"


def _redirect_legacy_rebuild() -> None:
    if os.environ.get(REDIRECT_GUARD) == "1":
        return

    requested_script = Path(sys.argv[0]).name.lower()
    if requested_script != LEGACY_ENTRYPOINT:
        return

    project_root = Path(__file__).resolve().parent
    paged_script = project_root / PAGED_ENTRYPOINT
    if not paged_script.exists():
        return

    environment = os.environ.copy()
    environment[REDIRECT_GUARD] = "1"
    os.execve(
        sys.executable,
        [sys.executable, str(paged_script), *sys.argv[1:]],
        environment,
    )


_redirect_legacy_rebuild()
