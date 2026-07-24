"""Project-wide Python startup overrides for the database rebuild."""

import fresh_mfl_database_rebuild as rebuild


# Number of player IDs requested in each Flow metadata batch.
rebuild.FLOW_BATCH_SIZE = 3000

# Number of wallet addresses requested in each Flow wallet-ownership batch.
rebuild.WALLET_BATCH_SIZE = 3000


_latest_highest_player_id = rebuild.MIN_PLAYER_ID - 1
_original_fetch_leaderboard = rebuild.fetch_leaderboard
_original_build_current_ownership = rebuild.build_current_ownership


def fetch_leaderboard_with_highest_id():
    global _latest_highest_player_id
    wallet_names, highest_player_id = _original_fetch_leaderboard()
    if highest_player_id is not None:
        _latest_highest_player_id = max(_latest_highest_player_id, highest_player_id)
    return wallet_names, highest_player_id


def build_current_ownership_with_blanks(wallet_players):
    ownership, duplicates = _original_build_current_ownership(wallet_players)
    highest_owned_id = max(ownership, default=rebuild.MIN_PLAYER_ID - 1)
    highest_player_id = max(_latest_highest_player_id, highest_owned_id)

    for player_id in range(rebuild.MIN_PLAYER_ID, highest_player_id + 1):
        ownership.setdefault(player_id, "")

    return ownership, duplicates


rebuild.fetch_leaderboard = fetch_leaderboard_with_highest_id
rebuild.build_current_ownership = build_current_ownership_with_blanks
