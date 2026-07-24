from __future__ import annotations

import sqlite3
from types import ModuleType
from typing import Any

import club_contract_rebuild
import owner_player_contract_sync


class ApiFirstPlayerSource:
    def __init__(self) -> None:
        self.items: dict[int, dict[str, Any]] = {}
        self.ownership: dict[int, str] = {}
        self.skipped_missing_flow_season: list[int] = []


STATE = ApiFirstPlayerSource()


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _first(*values: Any) -> Any:
    for value in values:
        if value not in (None, "", []):
            return value
    return None


def _int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return ", ".join(str(item) for item in value)
    return str(value)


def _player_id(item: dict[str, Any]) -> int | None:
    return owner_player_contract_sync._player_id(item)


def _owner(item: dict[str, Any]) -> str:
    metadata = _dict(item.get("metadata"))
    owner = _dict(item.get("owner"))
    wallet = _dict(item.get("wallet"))
    value = _first(
        item.get("ownerWalletAddress"),
        item.get("walletAddress"),
        item.get("ownerAddress"),
        owner.get("walletAddress"),
        owner.get("address"),
        wallet.get("address"),
        metadata.get("ownerWalletAddress"),
    )
    return str(value or "").lower()


def _wallet_name(item: dict[str, Any], owner: str) -> str:
    owner_data = _dict(item.get("owner"))
    wallet = _dict(item.get("wallet"))
    return str(
        _first(
            item.get("ownerName"),
            item.get("walletName"),
            owner_data.get("name"),
            wallet.get("name"),
            owner,
        )
        or owner
    )


def _attribute(item: dict[str, Any], name: str) -> Any:
    metadata = _dict(item.get("metadata"))
    attributes = _dict(item.get("attributes"))
    player = _dict(item.get("player"))
    return _first(
        item.get(name),
        attributes.get(name),
        metadata.get(name),
        player.get(name),
    )


def _contract_data(item: dict[str, Any]) -> tuple[Any, ...]:
    return owner_player_contract_sync._contract_values(item)


def _api_row(
    module: ModuleType,
    item: dict[str, Any],
    flow_player: Any,
    old: dict[str, Any] | None,
    wallet_names: dict[str, str],
) -> tuple[Any, ...]:
    player_id = _player_id(item)
    if player_id is None:
        raise RuntimeError("Players API returned an item without a player ID")

    owner = _owner(item)
    if not owner:
        raise RuntimeError(f"Players API returned no owner for player {player_id}")

    metadata = _dict(item.get("metadata"))
    old = old or {}
    contract_values = _contract_data(item)
    revenue_share, club_id, club_name, club_division, _, _, owned_since, retirement_years = contract_values

    raw_season = getattr(flow_player, "season", None)
    player_seasons = _int(raw_season)
    if player_seasons is None or player_seasons <= 0:
        raise RuntimeError(f"Flow season missing or invalid for player {player_id}: {raw_season!r}")

    values: dict[str, Any] = {
        "player_id": player_id,
        "wallet_address": owner,
        "wallet_name": wallet_names.get(owner) or _wallet_name(item, owner),
        "name": _text(_first(item.get("name"), metadata.get("name"))),
        "positions": _text(_first(item.get("positions"), metadata.get("positions"))),
        "age": _int(_first(item.get("age"), metadata.get("age"))),
        "nationality": _text(
            _first(
                item.get("nationality"),
                item.get("nationalities"),
                metadata.get("nationality"),
                metadata.get("nationalities"),
            )
        ),
        "preferred_foot": _text(
            _first(item.get("preferredFoot"), metadata.get("preferredFoot"))
        ),
        "height": _int(_first(item.get("height"), metadata.get("height"))),
        "retirement_years": retirement_years,
        "owned_since": owned_since,
        "active_contract_revenue_share": revenue_share,
        "active_contract_club_id": club_id,
        "active_contract_club_name": club_name,
        "active_contract_club_division": club_division,
        "overall": _int(_attribute(item, "overall")),
        "pace": _int(_attribute(item, "pace")),
        "shooting": _int(_attribute(item, "shooting")),
        "passing": _int(_attribute(item, "passing")),
        "dribbling": _int(_attribute(item, "dribbling")),
        "defense": _int(_attribute(item, "defense")),
        "physical": _int(_attribute(item, "physical")),
        "goalkeeping": _int(_attribute(item, "goalkeeping")),
        "player_seasons": player_seasons,
    }
    for column in module.PROGRESSION_COLUMNS:
        values[column] = old.get(column)
    for column in module.NEXT_OVERALL_COLUMNS:
        values[column] = None
    return tuple(values[column] for column in module.PLAYER_COLUMNS)


def _write_contract_alias_columns(connection: sqlite3.Connection) -> None:
    club_contract_rebuild.ensure_contract_columns(connection)
    updates: list[tuple[Any, ...]] = []
    for player_id, item in STATE.items.items():
        revenue_share, club_id, club_name, club_division, total_share, games, _, _ = _contract_data(item)
        updates.append(
            (
                revenue_share,
                club_id,
                club_name,
                club_division,
                total_share,
                games,
                player_id,
            )
        )
    connection.executemany(
        """
        UPDATE players
        SET revenue_share = ?, club_id = ?, club_name = ?, club_division = ?,
            total_revenue_share = ?, games_played = ?
        WHERE player_id = ?
        """,
        updates,
    )


def install_api_first_player_source(module: ModuleType) -> None:
    original_flow_fetch = module.fetch_all_players
    original_validate = module.validate_database

    module.PRESERVED_COLUMNS[:] = []

    def fetch_all_players(highest_player_id: int, flow_batch_size: int):
        print("Player data pull started", flush=True)
        api_items = owner_player_contract_sync.fetch_all_players()
        STATE.items = {}
        STATE.ownership = {}
        STATE.skipped_missing_flow_season = []
        for item in api_items:
            player_id = _player_id(item)
            if player_id is None:
                continue
            STATE.items[player_id] = item
            owner = _owner(item)
            if owner:
                STATE.ownership[player_id] = owner
        if not STATE.items:
            raise RuntimeError("PlayMFL API returned no players")
        print(f"Player data pull complete: {len(STATE.items)} players", flush=True)

        print("Flow season pull started", flush=True)
        flow_players = original_flow_fetch(highest_player_id, flow_batch_size)
        valid_flow_players: dict[int, Any] = {}
        skipped: list[int] = []
        for player_id in sorted(STATE.items):
            flow_player = flow_players.get(player_id)
            season = _int(getattr(flow_player, "season", None)) if flow_player is not None else None
            if season is None or season <= 0:
                skipped.append(player_id)
                continue
            valid_flow_players[player_id] = flow_player

        for player_id in skipped:
            STATE.items.pop(player_id, None)
            STATE.ownership.pop(player_id, None)
        STATE.skipped_missing_flow_season = skipped

        if not valid_flow_players:
            raise RuntimeError("Flow returned no usable player season data")
        print(
            f"Flow season pull complete: {len(valid_flow_players)} players, {len(skipped)} skipped",
            flush=True,
        )
        return valid_flow_players

    def replay_ownership_deposits(
        ownership: dict[int, str],
        *,
        start_height: int,
        end_height: int,
        window_size: int,
    ):
        del ownership, start_height, end_height, window_size
        return dict(STATE.ownership), 0, set(STATE.ownership)

    def replace_players(connection, flow_players, ownership, old_rows, wallet_names):
        del ownership
        module.create_players_table(connection)
        rows = [
            _api_row(
                module,
                STATE.items[player_id],
                flow_players[player_id],
                old_rows.get(player_id),
                wallet_names,
            )
            for player_id in sorted(flow_players)
        ]
        placeholders = ", ".join("?" for _ in module.PLAYER_COLUMNS)
        connection.executemany(
            f"INSERT INTO players_rebuild ({', '.join(module.PLAYER_COLUMNS)}) VALUES ({placeholders})",
            rows,
        )
        connection.execute("DROP TABLE players")
        connection.execute("ALTER TABLE players_rebuild RENAME TO players")
        connection.execute(
            "CREATE INDEX IF NOT EXISTS players_wallet_address_index ON players(wallet_address)"
        )
        _write_contract_alias_columns(connection)
        connection.commit()

    def validate_database(*args: Any, **kwargs: Any) -> dict[str, Any]:
        report = original_validate(*args, **kwargs)
        connection = args[0] if args else kwargs["connection"]
        errors = list(report.get("errors") or [])
        columns = [str(row[1]) for row in connection.execute("PRAGMA table_info(players)")]
        null_counts = {
            column: int(
                connection.execute(
                    f'SELECT COUNT(*) FROM players WHERE "{column}" IS NULL'
                ).fetchone()[0]
            )
            for column in columns
        }
        report.update(
            {
                "primary_player_source": "https://api.playmfl.com/players",
                "flow_player_fields_used": ["player_seasons"],
                "api_player_count_after_flow_season_filter": len(STATE.items),
                "players_skipped_missing_flow_season": len(STATE.skipped_missing_flow_season),
                "player_ids_skipped_missing_flow_season": STATE.skipped_missing_flow_season,
                "column_null_counts": null_counts,
            }
        )
        report["errors"] = errors
        report["valid"] = not errors
        return report

    module.fetch_all_players = fetch_all_players
    module.replay_ownership_deposits = replay_ownership_deposits
    module.replace_players = replace_players
    module.validate_database = validate_database
