"""Project-wide Python startup overrides for the database rebuild."""

import fresh_mfl_database_rebuild as rebuild


# Number of player IDs requested in each Flow metadata batch.
rebuild.FLOW_BATCH_SIZE = 3000

# Number of wallet addresses requested in each Flow wallet-ownership batch.
rebuild.WALLET_BATCH_SIZE = 3000

# Number of players requested in each progression API batch.
rebuild.PROGRESSION_BATCH_SIZE = 1500


_latest_highest_player_id = rebuild.MIN_PLAYER_ID - 1
_excluded_player_ids: set[int] = set()
_original_fetch_leaderboard = rebuild.fetch_leaderboard
_original_build_current_ownership = rebuild.build_current_ownership
_original_fetch_all_players = rebuild.fetch_all_players
_original_log = rebuild.log


def log_without_player_rows(message: str) -> None:
    if message.startswith("Player table row "):
        return
    _original_log(message)


def fetch_leaderboard_with_highest_id():
    global _latest_highest_player_id
    wallet_names, highest_player_id = _original_fetch_leaderboard()
    if highest_player_id is not None:
        _latest_highest_player_id = max(_latest_highest_player_id, highest_player_id)
    return wallet_names, highest_player_id


def build_current_ownership_with_blanks(wallet_players):
    system_addresses = {rebuild.MFL_ADDRESS, rebuild.MFL_TRADE_ADDRESS}

    for address in system_addresses:
        _excluded_player_ids.update(wallet_players.get(address, []))

    filtered_wallet_players = {
        address: player_ids
        for address, player_ids in wallet_players.items()
        if address not in system_addresses
    }
    ownership, duplicates = _original_build_current_ownership(filtered_wallet_players)
    highest_owned_id = max(ownership, default=rebuild.MIN_PLAYER_ID - 1)
    highest_player_id = max(_latest_highest_player_id, highest_owned_id)

    for player_id in range(rebuild.MIN_PLAYER_ID, highest_player_id + 1):
        if player_id not in _excluded_player_ids:
            ownership.setdefault(player_id, "")

    return ownership, duplicates


def fetch_all_players_without_system_wallets(*args, **kwargs):
    players = _original_fetch_all_players(*args, **kwargs)
    return {
        player_id: player
        for player_id, player in players.items()
        if player_id not in _excluded_player_ids
    }


rebuild.log = log_without_player_rows
rebuild.fetch_leaderboard = fetch_leaderboard_with_highest_id
rebuild.build_current_ownership = build_current_ownership_with_blanks
rebuild.fetch_all_players = fetch_all_players_without_system_wallets
