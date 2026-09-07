from __future__ import annotations

"""Canonical PlayMFL club leaderboard ingestion for the database rebuild."""

import sqlite3
from collections.abc import Callable
from typing import Any

CLUBS_LEADERBOARD_URL = (
    "https://api.playmfl.com/leaderboards/clubs/global"
    "?sort=nbMflPoints&sortOrder=DESC"
)
CLUB_LOGO_BASE_URL = "https://api.playmfl.com/u/clubs"


def _mapping(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _first_value(*values: Any) -> Any:
    for value in values:
        if value is not None and value != "":
            return value
    return None


def _club_entries(payload: Any) -> list[dict[str, Any]]:
    """Accept the known leaderboard envelope plus harmless API envelope variants."""
    if isinstance(payload, list):
        return [entry for entry in payload if isinstance(entry, dict)]
    if not isinstance(payload, dict):
        return []

    for key in ("clubs", "results", "items"):
        value = payload.get(key)
        if isinstance(value, list):
            return [entry for entry in value if isinstance(entry, dict)]

    data = payload.get("data")
    if isinstance(data, list):
        return [entry for entry in data if isinstance(entry, dict)]
    if isinstance(data, dict):
        return _club_entries(data)
    return []


def _owner(entry: dict[str, Any], club: dict[str, Any]) -> dict[str, Any]:
    for value in (
        club.get("ownedBy"),
        club.get("owner"),
        entry.get("ownedBy"),
        entry.get("owner"),
    ):
        if isinstance(value, dict):
            return value
    return {}


def normalize_club(entry: dict[str, Any], leaderboard_rank: int) -> dict[str, Any] | None:
    """Normalize one club result while tolerating nested leaderboard wrappers."""
    nested = _mapping(entry.get("club"))
    club = nested or entry
    owner = _owner(entry, club)

    club_id = str(_first_value(
        club.get("id"),
        club.get("clubId"),
        club.get("club_id"),
        entry.get("clubId"),
        entry.get("club_id"),
    ) or "").strip()
    if not club_id:
        return None

    owner_wallet_address = str(_first_value(
        owner.get("walletAddress"),
        owner.get("wallet_address"),
        owner.get("address"),
        club.get("ownerWalletAddress"),
        club.get("ownerAddress"),
        entry.get("ownerWalletAddress"),
        entry.get("ownerAddress"),
        entry.get("walletAddress"),
    ) or "").strip().lower()

    owner_name = str(_first_value(
        owner.get("name"),
        club.get("ownerName"),
        entry.get("ownerName"),
    ) or "").strip()

    name = str(_first_value(
        club.get("name"),
        entry.get("clubName"),
        entry.get("name"),
    ) or "").strip()
    division = _first_value(
        club.get("division"),
        club.get("divisionId"),
        entry.get("division"),
        entry.get("divisionId"),
    )
    logo_version = str(_first_value(
        club.get("logoVersion"),
        club.get("logo_version"),
        entry.get("logoVersion"),
        entry.get("logo_version"),
    ) or "").strip()
    points = _first_value(
        entry.get("nbMflPoints"),
        club.get("nbMflPoints"),
        entry.get("mflPoints"),
        club.get("mflPoints"),
    )
    try:
        normalized_points = None if points in (None, "") else float(points)
    except (TypeError, ValueError):
        normalized_points = None

    return {
        "club_id": club_id,
        "name": name,
        "division": "" if division is None else str(division).strip(),
        "owner_wallet_address": owner_wallet_address,
        "owner_name": owner_name,
        "logo_version": logo_version,
        "leaderboard_rank": int(leaderboard_rank),
        "mfl_points": normalized_points,
    }


def club_logo_url(club_id: Any, logo_version: Any) -> str:
    normalized_id = str(club_id or "").strip()
    if not normalized_id:
        return ""
    version = str(logo_version or "").strip()
    suffix = f"?v={version}" if version else ""
    return f"{CLUB_LOGO_BASE_URL}/{normalized_id}/logo.webp{suffix}"


def ensure_club_schema(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS clubs (
            club_id TEXT PRIMARY KEY,
            name TEXT NOT NULL DEFAULT '',
            division TEXT NOT NULL DEFAULT '',
            owner_wallet_address TEXT NOT NULL DEFAULT '',
            owner_name TEXT NOT NULL DEFAULT '',
            logo_version TEXT NOT NULL DEFAULT '',
            leaderboard_rank INTEGER NOT NULL,
            mfl_points REAL
        )
        """
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS clubs_owner_wallet_index "
        "ON clubs(owner_wallet_address, leaderboard_rank, club_id)"
    )


def refresh_clubs(
    connection: sqlite3.Connection,
    request_json: Callable[..., Any],
    limiter: Any = None,
) -> int:
    """Fetch and replace the canonical club table from the PlayMFL leaderboard."""
    payload = request_json(CLUBS_LEADERBOARD_URL, "Club leaderboard", limiter)
    entries = _club_entries(payload)
    if not entries:
        raise RuntimeError("Club leaderboard response did not contain any clubs")

    clubs: dict[str, dict[str, Any]] = {}
    for rank, entry in enumerate(entries, start=1):
        club = normalize_club(entry, rank)
        if club is not None:
            clubs[club["club_id"]] = club
    if not clubs:
        raise RuntimeError("Club leaderboard response did not contain valid club IDs")

    ensure_club_schema(connection)
    connection.execute("DELETE FROM clubs")
    connection.executemany(
        """
        INSERT INTO clubs (
            club_id,
            name,
            division,
            owner_wallet_address,
            owner_name,
            logo_version,
            leaderboard_rank,
            mfl_points
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                club["club_id"],
                club["name"],
                club["division"],
                club["owner_wallet_address"],
                club["owner_name"],
                club["logo_version"],
                club["leaderboard_rank"],
                club["mfl_points"],
            )
            for club in clubs.values()
        ],
    )
    connection.commit()
    return len(clubs)
