from __future__ import annotations

"""Build progression-email portrait URLs from canonical MFL player IDs."""

import os
import re
from typing import Any
from urllib.parse import quote

PLAYER_PORTRAIT_ORIGIN = "https://d13e14gtps4iwl.cloudfront.net"
PLAYER_PORTRAIT_PATH_PREFIX = "/players/v2"
DEFAULT_EMAIL_BASE_URL = "https://mfl-front-office.vercel.app"
PROGRESSION_EMAIL_PORTRAIT_PATH = "/api/progression-email-portrait"
PLAYER_ID_PATTERN = re.compile(r"^\d{1,20}$")


def normalized_portrait_player_id(value: Any) -> str:
    if isinstance(value, dict):
        value = value.get("id")
    player_id = str(value or "").strip()
    return player_id if PLAYER_ID_PATTERN.fullmatch(player_id) else ""


def canonical_player_portrait_url(player_or_id: Any) -> str:
    """Return the unmodified canonical MFL WebP portrait source URL."""
    player_id = normalized_portrait_player_id(player_or_id)
    if not player_id:
        return ""
    return f"{PLAYER_PORTRAIT_ORIGIN}{PLAYER_PORTRAIT_PATH_PREFIX}/{player_id}/photo.webp"


def player_portrait_url(player_or_id: Any) -> str:
    """Return the exact-crop 72x72 portrait endpoint used by progression emails."""
    player_id = normalized_portrait_player_id(player_or_id)
    if not player_id:
        return ""
    base_url = os.environ.get("EMAIL_BASE_URL", DEFAULT_EMAIL_BASE_URL).rstrip("/")
    return f"{base_url}{PROGRESSION_EMAIL_PORTRAIT_PATH}?player={quote(player_id)}"
