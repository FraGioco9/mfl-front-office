from __future__ import annotations

import json
import math
import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import club_contract_rebuild

PLAYERS_URL = "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players"
PAGE_LIMIT = 1500
WORKERS = 100
RETRIES = 3
RETRY_DELAY_SECONDS = 90
STATUS_BATCH_SIZE = 25
REQUEST_TIMEOUT_SECONDS = 30

UPDATED_COLUMNS = {
    "retirement_years",
    "owned_since",
    "active_contract_revenue_share",
    "active_contract_club_id",
    "active_contract_club_name",
    "active_contract_club_division",
    "revenue_share",
    "club_id",
    "club_name",
    "club_division",
    "total_revenue_share",
    "games_played",
}


def _int_or_none(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _first(mapping: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in mapping and mapping[key] not in (None, ""):
            return mapping[key]
    return None


def _players_from_payload(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        for key in ("players", "data", "items", "results"):
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
    raise RuntimeError("Owner players API returned an unexpected payload")


def _player_id(item: dict[str, Any]) -> int | None:
    metadata = item.get("metadata")
    if isinstance(metadata, dict):
        value = _int_or_none(_first(metadata, "id", "playerId", "player_id"))
        if value is not None:
            return value
    player = item.get("player")
    if isinstance(player, dict):
        value = _int_or_none(_first(player, "id", "playerId", "player_id"))
        if value is not None:
            return value
    return _int_or_none(_first(item, "id", "playerId", "player_id"))


def _request_owner_page(owner: str, offset: int) -> list[dict[str, Any]]:
    query = urlencode(
        {
            "limit": PAGE_LIMIT,
            "offset": offset,
            "ownerWalletAddress": owner,
        }
    )
    request = Request(
        f"{PLAYERS_URL}?{query}",
        headers={
            "Accept": "application/json",
            "User-Agent": "mfl-front-office-owner-player-sync/1.0",
        },
    )
    label = f"Owner {owner} players offset {offset}"

    for attempt in range(RETRIES + 1):
        try:
            with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                payload = json.loads(response.read().decode("utf-8"))
            return _players_from_payload(payload)
        except HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            failure = f"HTTP {error.code}: {body}"
        except (URLError, TimeoutError) as error:
            failure = str(error)
        except json.JSONDecodeError as error:
            failure = f"invalid JSON: {error}"

        if attempt == RETRIES:
            raise RuntimeError(f"{label} failed after retries: {failure}")
        print(
            f"{label} request failed ({failure}); retrying in {RETRY_DELAY_SECONDS}s "
            f"({attempt + 1}/{RETRIES})",
            flush=True,
        )
        time.sleep(RETRY_DELAY_SECONDS)

    raise RuntimeError(f"{label} request failed after retries")


def fetch_owner_players(owner: str) -> list[dict[str, Any]]:
    players: list[dict[str, Any]] = []
    seen_ids: set[int] = set()
    offset = 0

    while True:
        page = _request_owner_page(owner, offset)
        new_items: list[dict[str, Any]] = []
        for item in page:
            player_id = _player_id(item)
            if player_id is None or player_id in seen_ids:
                continue
            seen_ids.add(player_id)
            new_items.append(item)
        players.extend(new_items)

        if len(page) < PAGE_LIMIT:
            break
        if not new_items:
            raise RuntimeError(
                f"Owner {owner} pagination returned no new players at offset {offset}; "
                "the API may not support offset pagination"
            )
        offset += len(page)

    return players


def _contract_values(item: dict[str, Any]) -> tuple[Any, ...]:
    metadata = item.get("metadata") if isinstance(item.get("metadata"), dict) else {}
    contract = item.get("activeContract")
    if not isinstance(contract, dict):
        for key in ("contract", "currentContract", "sportingContract"):
            candidate = item.get(key)
            if isinstance(candidate, dict):
                contract = candidate
                break
        else:
            contract = {}
    club = item.get("club") if isinstance(item.get("club"), dict) else {}
    stats = item.get("stats") if isinstance(item.get("stats"), dict) else {}

    revenue_share = _int_or_none(
        _first(contract, "revenueShare", "revenue_share")
        or _first(item, "revenueShare", "revenue_share")
    )
    club_id = _int_or_none(
        _first(contract, "clubId", "clubID", "club_id")
        or _first(club, "id", "clubId", "clubID", "club_id")
        or _first(item, "clubId", "clubID", "club_id")
    )
    club_name = str(
        _first(contract, "clubName", "club_name")
        or _first(club, "name", "clubName", "club_name")
        or _first(item, "clubName", "club_name")
        or ""
    )
    club_division = _int_or_none(
        _first(contract, "clubDivision", "club_division")
        or _first(club, "division", "clubDivision", "club_division")
        or _first(item, "clubDivision", "club_division")
    )
    total_revenue_share = _int_or_none(
        _first(contract, "totalRevenueShareLocked", "totalRevenueShare", "total_revenue_share")
        or _first(item, "totalRevenueShareLocked", "totalRevenueShare", "total_revenue_share")
    )
    games_played = _int_or_none(
        _first(stats, "nbMatches", "gamesPlayed", "games_played")
        or _first(item, "nbMatches", "gamesPlayed", "games_played")
    )
    owned_since = _int_or_none(
        _first(item, "ownedSince", "owned_since", "ownershipSeason", "ownership_season")
        or _first(metadata, "ownedSince", "owned_since", "ownershipSeason", "ownership_season")
    )
    retirement_years = _int_or_none(
        _first(item, "retirementYears", "retirement_years")
        or _first(metadata, "retirementYears", "retirement_years")
    )

    return (
        revenue_share,
        club_id,
        club_name,
        club_division,
        total_revenue_share,
        games_played,
        owned_since,
        retirement_years,
    )


def refresh_owner_player_data(
    connection: sqlite3.Connection,
    _clubs: list[dict[str, Any]],
) -> int:
    club_contract_rebuild.ensure_contract_columns(connection)
    connection.execute(
        """
        UPDATE players
        SET revenue_share = NULL,
            club_id = NULL,
            club_name = NULL,
            club_division = NULL,
            total_revenue_share = NULL,
            games_played = NULL,
            owned_since = NULL,
            retirement_years = NULL
        """
    )

    owners = [
        str(row[0]).lower()
        for row in connection.execute(
            "SELECT DISTINCT wallet_address FROM players WHERE trim(wallet_address) != '' ORDER BY wallet_address"
        ).fetchall()
    ]
    total_owners = len(owners)
    total_batches = max(1, math.ceil(total_owners / STATUS_BATCH_SIZE))
    print(
        f"Contracts fetching started: {total_owners} owners, limit {PAGE_LIMIT}, "
        f"workers {WORKERS}, retries {RETRIES}, delay {RETRY_DELAY_SECONDS}s",
        flush=True,
    )

    payloads: dict[str, list[dict[str, Any]]] = {}
    completed = 0
    total_players = 0
    group_players = 0
    with ThreadPoolExecutor(max_workers=max(1, min(WORKERS, total_owners))) as executor:
        futures = {executor.submit(fetch_owner_players, owner): owner for owner in owners}
        for future in as_completed(futures):
            owner = futures[future]
            items = future.result()
            payloads[owner] = items
            completed += 1
            group_players += len(items)
            total_players += len(items)
            if completed % STATUS_BATCH_SIZE == 0 or completed == total_owners:
                batch_number = math.ceil(completed / STATUS_BATCH_SIZE)
                batch_start = max(1, completed - STATUS_BATCH_SIZE + 1)
                print(
                    f"Contracts {batch_number}/{total_batches}: owners {batch_start}-{completed}, "
                    f"+{group_players}, total {total_players}",
                    flush=True,
                )
                group_players = 0

    updates: list[tuple[Any, ...]] = []
    seen_players: set[int] = set()
    for owner in owners:
        for item in payloads.get(owner, []):
            player_id = _player_id(item)
            if player_id is None:
                continue
            if player_id in seen_players:
                raise RuntimeError(f"Player {player_id} was returned for more than one owner")
            seen_players.add(player_id)
            updates.append((*_contract_values(item), player_id))

    connection.executemany(
        """
        UPDATE players
        SET revenue_share = ?,
            club_id = ?,
            club_name = ?,
            club_division = ?,
            total_revenue_share = ?,
            games_played = ?,
            owned_since = ?,
            retirement_years = ?
        WHERE player_id = ?
        """,
        updates,
    )
    print(f"Contracts complete: {len(updates)} players", flush=True)
    return len(updates)


def install_owner_player_contract_sync(rebuild_module: Any) -> None:
    rebuild_module.PRESERVED_COLUMNS = [
        column for column in rebuild_module.PRESERVED_COLUMNS if column not in UPDATED_COLUMNS
    ]
    club_contract_rebuild.refresh_club_contracts = refresh_owner_player_data
