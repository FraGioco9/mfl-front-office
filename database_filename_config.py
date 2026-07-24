from __future__ import annotations

from pathlib import Path
from types import ModuleType

DATABASE_FILENAME = "mfl_database.db"
CANDIDATE_DATABASE_FILENAME = "mfl_database_candidate.db"


def install_database_filename_config(rebuild_module: ModuleType) -> None:
    base_path = Path(rebuild_module.__file__).resolve().parent
    rebuild_module.DATABASE_PATH = base_path / DATABASE_FILENAME
    rebuild_module.CANDIDATE_PATH = base_path / CANDIDATE_DATABASE_FILENAME
