from __future__ import annotations

from pathlib import Path
from types import ModuleType
from typing import Any

from fresh_database_rebuild import install_fresh_database_rebuild


def install_candidate_only_rebuild(rebuild_module: ModuleType) -> None:
    original_os = rebuild_module.os
    previous_print = rebuild_module.print
    state: dict[str, Path | None] = {
        "candidate": None,
        "database": None,
    }

    class OSProxy:
        def __getattr__(self, name: str) -> Any:
            return getattr(original_os, name)

        @staticmethod
        def replace(source: Any, destination: Any) -> None:
            state["candidate"] = Path(source)
            state["database"] = Path(destination)

    def candidate_print(*args: Any, **kwargs: Any) -> None:
        if args and isinstance(args[0], str) and args[0].startswith(
            "Flow database rebuild complete:"
        ):
            candidate = state["candidate"] or Path(rebuild_module.CANDIDATE_PATH)
            database = state["database"] or Path(rebuild_module.DATABASE_PATH)
            previous_print(f"Candidate ready: {candidate}", *args[1:], **kwargs)
            previous_print(
                f"Current database unchanged: {database}", *args[1:], **kwargs
            )
            return
        previous_print(*args, **kwargs)

    rebuild_module.os = OSProxy()
    rebuild_module.print = candidate_print
    install_fresh_database_rebuild(rebuild_module)
