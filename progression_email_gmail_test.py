#!/usr/bin/env python3
"""Send one manual progression-email test to an explicit recipient.

This helper is intentionally isolated from wallet preferences and Supabase. It
loads selected players from the current database, uses branch-rendered portrait
PNGs, and sends exactly one message through the production email MIME/CID path.
"""

from __future__ import annotations

import argparse
from email.utils import parseaddr
from pathlib import Path
from typing import Callable

import send_progression_emails as emails

MAX_TEST_PLAYERS = 10
SHOWCASE_FIXTURE = "showcase"
SHOWCASE_PLAYER_IDS = ("374512", "265327", "185140", "250483")
SHOWCASE_CHANGE_COLUMNS = (
    ("overall", "passing", "dribbling"),
    ("overall", "shooting"),
    ("pace",),
    ("defense", "physical"),
)


def validated_recipient(value: str) -> str:
    recipient = str(value or "").strip()
    if not recipient or any(character in recipient for character in "\r\n,;"):
        raise ValueError("Enter exactly one recipient email address.")
    _, parsed = parseaddr(recipient)
    if parsed != recipient or "@" not in parsed or parsed.startswith("@") or parsed.endswith("@"):
        raise ValueError("Enter a valid recipient email address.")
    return recipient


def fixture_change(current: dict[str, object], column: str) -> tuple[str, int, int]:
    new_value = emails.parse_int(current.get(column))
    if new_value is None or new_value <= 0:
        new_value = 1
    return column, max(0, new_value - 1), new_value


def showcase_players(current_db: Path) -> list[emails.PlayerImprovement]:
    rows = emails.load_players(current_db)
    missing = [player_id for player_id in SHOWCASE_PLAYER_IDS if player_id not in rows]
    if missing:
        raise ValueError(
            "Showcase Gmail fixture players are missing from the database: "
            + ", ".join(missing)
        )

    players: list[emails.PlayerImprovement] = []
    for player_id, change_columns in zip(
        SHOWCASE_PLAYER_IDS,
        SHOWCASE_CHANGE_COLUMNS,
        strict=True,
    ):
        current = rows[player_id]
        changes = tuple(fixture_change(current, column) for column in change_columns)
        current_overall = emails.parse_int(current.get("overall"))
        if current_overall is None or current_overall <= 0:
            current_overall = 1
        has_overall_change = "overall" in change_columns
        players.append(
            emails.PlayerImprovement(
                player_id=player_id,
                name=str(current.get("name") or f"Player {player_id}"),
                wallet_address=emails.normalize_wallet(current.get("wallet_address")),
                wallet_name=str(
                    current.get("wallet_name")
                    or current.get("wallet_address")
                    or ""
                ),
                positions=str(current.get("positions") or ""),
                old_overall=(
                    max(0, current_overall - 1)
                    if has_overall_change
                    else current_overall
                ),
                new_overall=current_overall,
                changes=changes,
            )
        )

    hydrated = emails.attach_player_portraits(
        {player.player_id: player for player in players}
    )
    return emails.unique_players(
        [hydrated[player.player_id] for player in players]
    )


def selected_players(
    current_db: Path,
    player_ids_csv: str,
    fixture: str = "database",
) -> list[emails.PlayerImprovement]:
    if fixture == SHOWCASE_FIXTURE:
        return showcase_players(current_db)
    if fixture != "database":
        raise ValueError(f"Unknown Gmail test fixture: {fixture}")

    requested = emails.parse_preview_player_ids("", player_ids_csv)
    if len(requested) > MAX_TEST_PLAYERS:
        raise ValueError(f"A Gmail test can include at most {MAX_TEST_PLAYERS} players.")

    players = emails.preview_players_from_database(current_db, requested)
    hydrated = emails.attach_player_portraits(
        {player.player_id: player for player in players}
    )
    return emails.unique_players(
        [hydrated[player.player_id] for player in players]
    )


def local_portrait_loader(
    players: list[emails.PlayerImprovement],
    portrait_directory: Path,
) -> Callable[[str], bytes | None]:
    paths_by_url = {
        player.portrait_url: portrait_directory / f"{player.player_id}.png"
        for player in players
        if player.portrait_url
    }

    def load(url: str) -> bytes | None:
        path = paths_by_url.get(str(url or ""))
        if path is None:
            raise RuntimeError("Test email requested an unexpected portrait URL.")
        if not path.is_file():
            raise RuntimeError(f"Rendered test portrait is missing: {path}")
        payload = path.read_bytes()
        if not payload.startswith(emails.PNG_SIGNATURE):
            raise RuntimeError(f"Rendered test portrait is not a PNG: {path}")
        if len(payload) > emails.INLINE_PORTRAIT_MAX_BYTES:
            raise RuntimeError(f"Rendered test portrait is too large: {path}")
        return payload

    return load


def send_test_email(
    current_db: Path,
    portrait_directory: Path,
    recipient: str,
    player_ids_csv: str,
    theme: str,
    fixture: str = "database",
) -> list[emails.PlayerImprovement]:
    recipient = validated_recipient(recipient)
    if theme not in {"light", "dark"}:
        raise ValueError("Theme must be light or dark.")
    if not current_db.is_file():
        raise RuntimeError(f"Current database was not found: {current_db}")
    if not emails.email_configured():
        raise RuntimeError("SMTP email secrets are not configured.")

    players = selected_players(current_db, player_ids_csv, fixture)
    loader = local_portrait_loader(players, portrait_directory)
    original_loader = emails.load_inline_portrait_png
    emails.load_inline_portrait_png = loader
    try:
        scope_name = "Gmail Test"
        emails.send_email(
            recipient,
            f"[TEST] {emails.build_subject(scope_name, players)}",
            emails.build_text(scope_name, players),
            emails.build_html(scope_name, players, theme),
            players,
        )
    finally:
        emails.load_inline_portrait_png = original_loader

    return players


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Send one Gmail progression-email rendering test."
    )
    parser.add_argument("--current-db", required=True)
    parser.add_argument("--portrait-dir", required=True)
    parser.add_argument("--recipient", required=True)
    parser.add_argument("--player-ids", default="")
    parser.add_argument("--theme", choices=("light", "dark"), default="dark")
    parser.add_argument(
        "--fixture",
        choices=("database", SHOWCASE_FIXTURE),
        default="database",
        help=(
            "Use 'showcase' for the deterministic four-player Gmail layout test: "
            "374512 overall+2 stats; 265327 overall+1 stat; "
            "185140 1 stat; 250483 2 stats."
        ),
    )
    args = parser.parse_args()

    try:
        players = send_test_email(
            Path(args.current_db),
            Path(args.portrait_dir),
            args.recipient,
            args.player_ids,
            args.theme,
            args.fixture,
        )
    except (RuntimeError, ValueError) as error:
        print(f"Progression email Gmail test failed: {error}")
        return 1

    print(
        f"Sent one progression email Gmail test with {len(players)} player"
        f"{'s' if len(players) != 1 else ''}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
