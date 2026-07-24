from __future__ import annotations

from pathlib import Path
from types import ModuleType

import club_contract_rebuild
import flow_data
import leaderboard_rebuild
import owner_player_contract_sync
import progression_rebuild

DATABASE_FILENAME = "mfl_database.db"
CANDIDATE_DATABASE_FILENAME = "mfl_database_candidate.db"
MFL_API_BASE_URL = "https://api.playmfl.com"


def install_database_filename_config(rebuild_module: ModuleType) -> None:
    base_path = Path(rebuild_module.__file__).resolve().parent
    rebuild_module.DATABASE_PATH = base_path / DATABASE_FILENAME
    rebuild_module.CANDIDATE_PATH = base_path / CANDIDATE_DATABASE_FILENAME

    flow_data.PLAYERS_API_URL = f"{MFL_API_BASE_URL}/players"
    owner_player_contract_sync.PLAYERS_URL = f"{MFL_API_BASE_URL}/players"
    progression_rebuild.PROGRESSIONS_API_URL = f"{MFL_API_BASE_URL}/players/progressions"
    leaderboard_rebuild.LEADERBOARD_API_URL = (
        f"{MFL_API_BASE_URL}/leaderboards/users/global"
    )
    club_contract_rebuild.CLUB_PLAYERS_URL = (
        f"{MFL_API_BASE_URL}/clubs/{{club_id}}/players"
    )
