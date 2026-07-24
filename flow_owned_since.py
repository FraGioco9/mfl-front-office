from __future__ import annotations

from types import ModuleType

from contract_column_order import install_contract_column_order
from owner_player_contract_sync import install_owner_player_contract_sync


def install_owned_since_hook(rebuild_module: ModuleType) -> None:
    """Use the owner-filtered players API for contracts and ownership-history fields."""
    install_owner_player_contract_sync(rebuild_module)
    install_contract_column_order()
