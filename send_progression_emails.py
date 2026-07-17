#!/usr/bin/env python3
"""Send progression improvement emails after a database refresh.

The script compares a previous SQLite database with the freshly refreshed one,
then sends one email per enabled notification scope in wallet_preferences:
- myplayers
- watchlist-<id>
"""

from __future__ import annotations

import argparse
import html
import json
import os
import smtplib
import sqlite3
import ssl
import sys
from dataclasses import dataclass
from email.message import EmailMessage
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

STAT_COLUMNS = [
    "overall",
    "pace",
    "shooting",
    "passing",
    "dribbling",
    "defense",
    "physical",
    "goalkeeping",
]
DEFAULT_BASE_URL = "https://mfl-front-office.vercel.app"
SUPABASE_PAGE_SIZE = 1000


@dataclass(frozen=True)
class PlayerImprovement:
    player_id: str
    name: str
    wallet_address: str
    wallet_name: str
    positions: str
    old_overall: int | None
    new_overall: int | None
    changes: tuple[tuple[str, int, int], ...]


def normalize_wallet(value: Any) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return ""
    return text if text.startswith("0x") else f"0x{text}"


def parse_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def table_columns(connection: sqlite3.Connection, table_name: str) -> set[str]:
    return {row[1] for row in connection.execute(f"PRAGMA table_info({table_name})")}


def load_players(db_path: Path) -> dict[str, dict[str, Any]]:
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    try:
        columns = table_columns(connection, "players")
        needed = [
            "player_id",
            "wallet_address",
            "wallet_name",
            "name",
            "positions",
            *[column for column in STAT_COLUMNS if column in columns],
        ]
        rows = connection.execute(f"SELECT {', '.join(needed)} FROM players").fetchall()
        return {str(row["player_id"]): dict(row) for row in rows}
    finally:
        connection.close()


def changed_players(previous_db: Path, current_db: Path) -> dict[str, PlayerImprovement]:
    previous_players = load_players(previous_db)
    current_players = load_players(current_db)
    improvements: dict[str, PlayerImprovement] = {}

    for player_id, current in current_players.items():
        previous = previous_players.get(player_id)
        if not previous:
            continue

        changes: list[tuple[str, int, int]] = []
        for column in STAT_COLUMNS:
            if column not in current or column not in previous:
                continue
            old_value = parse_int(previous.get(column))
            new_value = parse_int(current.get(column))
            if old_value is not None and new_value is not None and new_value > old_value:
                changes.append((column, old_value, new_value))

        if not changes:
            continue

        improvements[player_id] = PlayerImprovement(
            player_id=player_id,
            name=str(current.get("name") or f"Player {player_id}"),
            wallet_address=normalize_wallet(current.get("wallet_address")),
            wallet_name=str(current.get("wallet_name") or current.get("wallet_address") or ""),
            positions=str(current.get("positions") or ""),
            old_overall=parse_int(previous.get("overall")),
            new_overall=parse_int(current.get("overall")),
            changes=tuple(changes),
        )

    return improvements


def supabase_configured() -> bool:
    return bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))


def supabase_request(path: str) -> Any:
    base_url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    request = Request(
        f"{base_url}/rest/v1/{path}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
    )
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def load_preferences() -> list[dict[str, Any]]:
    preferences: list[dict[str, Any]] = []
    offset = 0
    while True:
        query = (
            "wallet_preferences"
            "?select=wallet_address,watchlists,settings"
            "&order=wallet_address.asc"
            f"&limit={SUPABASE_PAGE_SIZE}&offset={offset}"
        )
        rows = supabase_request(query)
        if not isinstance(rows, list) or not rows:
            break
        preferences.extend(rows)
        if len(rows) < SUPABASE_PAGE_SIZE:
            break
        offset += SUPABASE_PAGE_SIZE
    return preferences


def email_configured() -> bool:
    required = ["SMTP_HOST", "SMTP_USERNAME", "SMTP_PASSWORD", "EMAIL_FROM"]
    return all(os.environ.get(key) for key in required)


def format_stat_name(column: str) -> str:
    if column == "overall":
        return "OVERALL"
    return column.replace("_", " ")


def overall_delta(player: PlayerImprovement) -> int:
    for column, old_value, new_value in player.changes:
        if column == "overall":
            return new_value - old_value
    return 0


def improvement_count(player: PlayerImprovement) -> int:
    return len(player.changes)


def player_sort_key(player: PlayerImprovement) -> tuple[int, int, str, int]:
    numeric_id = int(player.player_id) if player.player_id.isdigit() else 0
    return (-overall_delta(player), -improvement_count(player), player.name.lower(), numeric_id)


def format_text_changes(player: PlayerImprovement) -> str:
    return "\n".join(
        f"{format_stat_name(column)}: {new_value} (+{new_value - old_value})"
        for column, old_value, new_value in player.changes
    )


def format_html_changes(player: PlayerImprovement) -> str:
    lines = []
    for column, old_value, new_value in player.changes:
        label = html.escape(format_stat_name(column))
        value = html.escape(str(new_value))
        delta = html.escape(f"+{new_value - old_value}")
        lines.append(
            f'<div style="margin:0 0 5px;color:#bdd0df;line-height:1.35;">{label}: '
            f'<strong style="color:#ffffff;font-weight:800;">{value}</strong> '
            f'<span style="color:#2fbf62;font-weight:inherit;">({delta})</span></div>'
        )
    return "".join(lines)


def player_url(player_id: str) -> str:
    return f"{os.environ.get('EMAIL_BASE_URL', DEFAULT_BASE_URL).rstrip('/')}/players/{quote(player_id)}"


def build_subject(scope_name: str, players: list[PlayerImprovement]) -> str:
    noun = "player" if len(players) == 1 else "players"
    return f"MFL Front Office: {len(players)} improved {noun} in {scope_name}"


def build_text(scope_name: str, players: list[PlayerImprovement]) -> str:
    lines = [
        f"{scope_name}",
        "",
        "These players improved after the latest database refresh:",
        "",
    ]
    for player in players:
        lines.append(f"#{player.player_id} {player.name}")
        lines.append(format_text_changes(player))
        lines.append(player_url(player.player_id))
        lines.append("")
    return "\n".join(lines).strip()


def build_html(scope_name: str, players: list[PlayerImprovement]) -> str:
    rows = []
    for player in players:
        rows.append(
            "<tr style=\"border-top:1px solid #2d3a45;\">"
            f"<td style=\"padding:14px 12px;vertical-align:top;white-space:nowrap;\"><a style=\"color:#54d3ff;font-weight:800;text-decoration:none;\" href=\"{html.escape(player_url(player.player_id))}\">#{html.escape(player.player_id)}</a></td>"
            f"<td style=\"padding:14px 12px;vertical-align:top;\"><strong style=\"display:block;color:#ffffff;\">{html.escape(player.name)}</strong><span style=\"display:block;margin-top:3px;color:#8fa6b8;font-size:12px;\">{html.escape(player.positions)}</span></td>"
            f"<td style=\"padding:14px 12px;vertical-align:top;color:#bdd0df;line-height:1.45;\">{format_html_changes(player)}</td>"
            "</tr>"
        )

    return f"""
<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <title>{html.escape(scope_name)} improvements</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Titillium+Web:wght@400;600;700;800&display=swap" rel="stylesheet">
  </head>
  <body style="margin:0;background:#0f151a;color:#eef6ff;font-family:'Titillium Web',Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f151a;padding:28px 14px;font-family:'Titillium Web',Arial,Helvetica,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:760px;background:#141c23;border:1px solid #2d3a45;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:28px 30px;background:linear-gradient(135deg,#1b2a34,#132029);border-bottom:1px solid #2d3a45;">
                <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#54d3ff;font-weight:800;">MFL Front Office</div>
                <h1 style="margin:8px 0 0;font-size:28px;line-height:1.15;color:#ffffff;">Player improvements</h1>
                <p style="margin:10px 0 0;color:#bdd0df;font-size:15px;">{html.escape(scope_name)} has {len(players)} improved {'player' if len(players) == 1 else 'players'} after the latest refresh.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 30px;">
                <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #2d3a45;border-radius:10px;overflow:hidden;">
                  <thead>
                    <tr style="background:#202c35;color:#ffffff;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.04em;">
                      <th style="padding:12px;">ID</th>
                      <th style="padding:12px;">Player</th>
                      <th style="padding:12px;">Improvement</th>
                    </tr>
                  </thead>
                  <tbody style="font-size:14px;color:#eef6ff;">
                    {''.join(rows)}
                  </tbody>
                </table>
                <p style="margin:18px 0 0;color:#8fa6b8;font-size:12px;line-height:1.5;">You received this because this notification is enabled in Settings. Manage it from MFL Front Office at any time.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def send_email(recipient: str, subject: str, text_body: str, html_body: str) -> None:
    message = EmailMessage()
    message["From"] = os.environ["EMAIL_FROM"]
    message["To"] = recipient
    message["Subject"] = subject
    if os.environ.get("EMAIL_REPLY_TO"):
        message["Reply-To"] = os.environ["EMAIL_REPLY_TO"]
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT") or "587")
    username = os.environ["SMTP_USERNAME"]
    password = os.environ["SMTP_PASSWORD"]

    if port == 465:
        with smtplib.SMTP_SSL(host, port, context=ssl.create_default_context(), timeout=30) as smtp:
            smtp.login(username, password)
            smtp.send_message(message)
        return

    with smtplib.SMTP(host, port, timeout=30) as smtp:
        smtp.ehlo()
        smtp.starttls(context=ssl.create_default_context())
        smtp.login(username, password)
        smtp.send_message(message)


def unique_players(players: list[PlayerImprovement]) -> list[PlayerImprovement]:
    seen: set[str] = set()
    unique: list[PlayerImprovement] = []
    for player in sorted(players, key=player_sort_key):
        if player.player_id in seen:
            continue
        seen.add(player.player_id)
        unique.append(player)
    return unique


def notification_jobs(preferences: list[dict[str, Any]], improvements: dict[str, PlayerImprovement]) -> list[tuple[str, str, list[PlayerImprovement]]]:
    jobs: list[tuple[str, str, list[PlayerImprovement]]] = []
    improvements_by_owner: dict[str, list[PlayerImprovement]] = {}
    for player in improvements.values():
        improvements_by_owner.setdefault(player.wallet_address, []).append(player)

    for preference in preferences:
        wallet = normalize_wallet(preference.get("wallet_address"))
        settings = preference.get("settings") if isinstance(preference.get("settings"), dict) else {}
        recipient = str(settings.get("emailAddress") or settings.get("email_address") or "").strip()
        enabled = set(settings.get("receiveEmailsFor") if isinstance(settings.get("receiveEmailsFor"), list) else [])
        if not recipient or not enabled:
            continue

        if "myplayers" in enabled:
            players = unique_players(improvements_by_owner.get(wallet, []))
            if players:
                jobs.append((recipient, "My Players", players))

        watchlists = preference.get("watchlists") if isinstance(preference.get("watchlists"), list) else []
        for watchlist in watchlists:
            if not isinstance(watchlist, dict):
                continue
            watchlist_id = str(watchlist.get("id") or "").strip()
            if not watchlist_id or f"watchlist-{watchlist_id}" not in enabled:
                continue
            player_ids = {str(player_id) for player_id in (watchlist.get("playerIds") or [])}
            players = unique_players([improvements[player_id] for player_id in player_ids if player_id in improvements])
            if players:
                name = str(watchlist.get("name") or "Watchlist").strip() or "Watchlist"
                jobs.append((recipient, f"Watchlist {name}", players))

    return jobs


def main() -> int:
    parser = argparse.ArgumentParser(description="Send MFL Front Office progression improvement emails.")
    parser.add_argument("--previous-db", default="previous-database/mfl_progression.db")
    parser.add_argument("--current-db", default="mfl_progression.db")
    args = parser.parse_args()

    previous_db = Path(args.previous_db)
    current_db = Path(args.current_db)
    if not previous_db.exists():
        print(f"Progression emails skipped: previous database not found at {previous_db}.")
        return 0
    if not current_db.exists():
        print(f"Progression emails skipped: current database not found at {current_db}.")
        return 0
    if not supabase_configured():
        print("Progression emails skipped: Supabase secrets are not configured.")
        return 0
    if not email_configured():
        print("Progression emails skipped: SMTP email secrets are not configured.")
        return 0

    improvements = changed_players(previous_db, current_db)
    if not improvements:
        print("No player stat improvements found; no progression emails sent.")
        return 0

    try:
        preferences = load_preferences()
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
        print(f"Progression emails skipped: could not read Supabase preferences: {error}")
        return 0

    jobs = notification_jobs(preferences, improvements)
    if not jobs:
        print(f"Found {len(improvements)} improved players, but no enabled email scopes matched them.")
        return 0

    sent = 0
    for recipient, scope_name, players in jobs:
        try:
            send_email(
                recipient,
                build_subject(scope_name, players),
                build_text(scope_name, players),
                build_html(scope_name, players),
            )
            sent += 1
            print(f"Sent {scope_name} progression email to {recipient} with {len(players)} players.")
        except Exception as error:  # noqa: BLE001 - keep database workflows alive if email delivery fails.
            print(f"Could not send {scope_name} progression email to {recipient}: {error}")

    print(f"Progression email notifications complete: {sent}/{len(jobs)} emails sent.")
    return 0


if __name__ == "__main__":
    sys.exit(main())