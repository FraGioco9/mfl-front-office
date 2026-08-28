#!/usr/bin/env python3
"""Send progression improvement emails after a database refresh.

The script compares a previous SQLite database with the freshly refreshed one,
then sends one email per enabled notification scope in wallet_preferences:
- myplayers
- watchlist-<id>

Use --preview-output to render the production email template for one or more
real players without Supabase or SMTP and without sending an email.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import smtplib
import sqlite3
import ssl
import sys
from dataclasses import dataclass, replace
from email.message import EmailMessage
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from player_portraits import player_portrait_url

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
DEFAULT_EMAIL_THEME = "dark"
SUPABASE_PAGE_SIZE = 1000
PORTRAIT_SIZE_PX = 72  # Source-crop height for the local browser preview only.
EMAIL_PORTRAIT_DISPLAY_HEIGHT_PX = 88
EMAIL_PORTRAIT_MOBILE_DISPLAY_HEIGHT_PX = 32
EMAIL_PORTRAIT_COMPACT_DISPLAY_HEIGHT_PX = 24
PLAYER_PORTRAIT_SLOT_PERCENT = 38
ID_COLUMN_WIDTH_PERCENT = 18
PLAYER_COLUMN_WIDTH_PERCENT = 50
IMPROVEMENT_COLUMN_WIDTH_PERCENT = 32
EMAIL_CARD_WIDTH_PERCENT = 94
EMAIL_PAGE_HORIZONTAL_PADDING_PERCENT = 3
EMAIL_CARD_HORIZONTAL_PADDING_PERCENT = 5
EMAIL_ROW_VERTICAL_PADDING_PERCENT = 3
EMAIL_ROW_HORIZONTAL_PADDING_PERCENT = 2
EMAIL_DESKTOP_FONT_SIZE_PX = 18
EMAIL_MOBILE_FONT_SIZE_PX = 13
EMAIL_COMPACT_FONT_SIZE_PX = 12
INLINE_PORTRAIT_MAX_BYTES = 4 * 1024 * 1024
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


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
    portrait_url: str = ""


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
            *[
                f"{column}_prog_all"
                for column in STAT_COLUMNS
                if f"{column}_prog_all" in columns
            ],
        ]
        rows = connection.execute(f"SELECT {', '.join(needed)} FROM players").fetchall()
        return {str(row["player_id"]): dict(row) for row in rows}
    finally:
        connection.close()


def authoritative_change(
    previous: dict[str, Any],
    current: dict[str, Any],
    column: str,
) -> tuple[int, int] | None:
    old_value = parse_int(previous.get(column))
    new_value = parse_int(current.get(column))
    progression_column = f"{column}_prog_all"
    old_progression = parse_int(previous.get(progression_column))
    new_progression = parse_int(current.get(progression_column))

    if old_progression is not None and new_progression is not None:
        delta = new_progression - old_progression
        if delta <= 0:
            return None
        if new_value is not None:
            return new_value - delta, new_value
        if old_value is not None:
            return old_value, old_value + delta
        return None

    if old_value is not None and new_value is not None and new_value > old_value:
        return old_value, new_value
    return None


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
            change = authoritative_change(previous, current, column)
            if change is not None:
                changes.append((column, change[0], change[1]))

        if not changes:
            continue

        overall_change = next(
            (
                (old_value, new_value)
                for column, old_value, new_value in changes
                if column == "overall"
            ),
            None,
        )
        improvements[player_id] = PlayerImprovement(
            player_id=player_id,
            name=str(current.get("name") or f"Player {player_id}"),
            wallet_address=normalize_wallet(current.get("wallet_address")),
            wallet_name=str(current.get("wallet_name") or current.get("wallet_address") or ""),
            positions=str(current.get("positions") or ""),
            old_overall=(
                overall_change[0]
                if overall_change
                else parse_int(previous.get("overall"))
            ),
            new_overall=(
                overall_change[1]
                if overall_change
                else parse_int(current.get("overall"))
            ),
            changes=tuple(changes),
        )

    return improvements


def load_player_portraits(
    player_ids: set[str],
    _portrait_cache_path: Path | None = None,
) -> dict[str, str]:
    """Derive the same canonical portrait URLs used by the site, with no API call."""
    portraits: dict[str, str] = {}
    for player_id in player_ids:
        portrait = player_portrait_url(player_id)
        if portrait:
            portraits[player_id] = portrait
    return portraits


def attach_player_portraits(
    improvements: dict[str, PlayerImprovement],
    portrait_cache_path: Path | None = None,
) -> dict[str, PlayerImprovement]:
    portraits = load_player_portraits(set(improvements), portrait_cache_path)
    return {
        player_id: replace(player, portrait_url=portraits.get(player_id, ""))
        for player_id, player in improvements.items()
    }


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


def normalize_email_theme(value: Any) -> str:
    return "light" if str(value or "").strip().lower() == "light" else DEFAULT_EMAIL_THEME


def apply_email_theme(rendered: str, theme_value: Any) -> str:
    theme = normalize_email_theme(theme_value)
    rendered = rendered.replace('content="light dark"', f'content="{theme}"')
    rendered = rendered.replace(
        ':root { color-scheme: light dark; supported-color-schemes: light dark; }',
        f':root {{ color-scheme: {theme}; supported-color-schemes: {theme}; }}',
    )

    dark_media_start = rendered.find('      @media (prefers-color-scheme: dark) {')
    if dark_media_start >= 0:
        style_end = rendered.find('    </style>', dark_media_start)
        if style_end < 0:
            raise RuntimeError('Progression email theme stylesheet is malformed.')
        rendered = rendered[:dark_media_start] + rendered[style_end:]

    if theme == "light":
        return rendered

    dark_colors = {
        "#f3f6f8": "#0f151a",
        "#ffffff": "#141c23",
        "#edf4f8": "#182630",
        "#e7eef3": "#202c35",
        "#17222b": "#ffffff",
        "#52697a": "#bdd0df",
        "#60778a": "#8fa6b8",
        "#007ca8": "#54d3ff",
        "#167a42": "#2fbf62",
        "#cbd7df": "#2d3a45",
        "#d6e0e7": "#2d3a45",
    }
    color_pattern = re.compile("|".join(re.escape(color) for color in dark_colors))
    return color_pattern.sub(lambda match: dark_colors[match.group(0)], rendered)


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


def stats_improvement_total(player: PlayerImprovement) -> int:
    return sum(
        new_value - old_value
        for column, old_value, new_value in player.changes
        if column != "overall"
    )


def player_sort_key(player: PlayerImprovement) -> tuple[int, int, int, int]:
    numeric_id = int(player.player_id) if player.player_id.isdigit() else 0
    current_overall = player.new_overall if player.new_overall is not None else -1
    return (
        -overall_delta(player),
        -current_overall,
        -stats_improvement_total(player),
        -numeric_id,
    )


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
            f'<div class="email-change" style="margin:0 0 .35em;color:#52697a;line-height:1.35;white-space:normal;overflow-wrap:anywhere;">{label}: '
            f'<span class="email-value" style="color:#17222b;font-weight:inherit;">{value}</span> '
            f'<span class="email-delta" style="color:#167a42;font-weight:inherit;">({delta})</span></div>'
        )
    return "".join(lines)

def player_url(player_id: str) -> str:
    return f"{os.environ.get('EMAIL_BASE_URL', DEFAULT_BASE_URL).rstrip('/')}/players/{quote(player_id)}"


def player_initials(player: PlayerImprovement) -> str:
    parts = [part for part in player.name.split() if part]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return f"{parts[0][0]}{parts[-1][0]}".upper()


def player_identity_html(player: PlayerImprovement) -> str:
    if player.portrait_url:
        portrait = (
            '<div class="player-portrait-shell" '
            'style="width:100%;background:transparent;overflow:hidden;">'
            f'<img class="email-player-portrait" src="{html.escape(player.portrait_url)}" alt="" '
            f'height="{EMAIL_PORTRAIT_DISPLAY_HEIGHT_PX}" '
            'style="display:block;width:auto;max-width:none;border:0;'
            'margin:0 auto;padding:0;background:transparent;">'
            '</div>'
        )
    else:
        portrait = (
            '<table class="player-portrait-shell" role="presentation" width="100%" '
            'cellspacing="0" cellpadding="0" '
            'style="width:100%;border-collapse:separate;background:transparent;">'
            '<tr><td align="center" valign="middle" '
            'style="width:100%;padding:32% 0;color:#60778a;font-size:75%;font-weight:700;line-height:1;">'
            f'{html.escape(player_initials(player))}</td></tr></table>'
        )

    return (
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
        'style="width:100%;border-collapse:collapse;table-layout:fixed;">'
        '<tr>'
        f'<td width="{PLAYER_PORTRAIT_SLOT_PERCENT}%" align="center" valign="top" '
        f'style="width:{PLAYER_PORTRAIT_SLOT_PERCENT}%;padding:0 4% 0 0;overflow:hidden;text-align:center;">{portrait}</td>'
        '<td valign="top" style="padding:0;overflow-wrap:anywhere;">'
        f'<strong class="email-player-name" style="display:block;color:#17222b;">{html.escape(player.name)}</strong>'
        f'<span class="email-position" style="display:block;margin-top:.25em;color:#60778a;font-size:75%;">'
        f'{html.escape(player.positions)}</span>'
        '</td>'
        '</tr>'
        '</table>'
    )

def build_subject(scope_name: str, players: list[PlayerImprovement]) -> str:
    return f"{scope_name} Progression Update"


def build_text(scope_name: str, players: list[PlayerImprovement]) -> str:
    lines = [
        scope_name,
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


def build_html(scope_name: str, players: list[PlayerImprovement], theme: str = DEFAULT_EMAIL_THEME) -> str:
    rows = []
    for player in players:
        rows.append(
            '<tr class="email-player-row" style="background:#ffffff;border-top:1px solid #d6e0e7;">'
            f'<td class="email-id-cell" style="width:{ID_COLUMN_WIDTH_PERCENT}%;padding:{EMAIL_ROW_VERTICAL_PADDING_PERCENT}% {EMAIL_ROW_HORIZONTAL_PADDING_PERCENT}%;vertical-align:top;font-size:80%;white-space:nowrap;overflow-wrap:normal;word-break:normal;">'
            f'<a class="email-link email-id-link" style="color:#007ca8;font-weight:inherit;text-decoration:none;white-space:nowrap;overflow-wrap:normal;word-break:normal;" '
            f'href="{html.escape(player_url(player.player_id))}">'
            f'#{html.escape(player.player_id)}</a></td>'
            f'<td style="width:{PLAYER_COLUMN_WIDTH_PERCENT}%;padding:{EMAIL_ROW_VERTICAL_PADDING_PERCENT}% {EMAIL_ROW_HORIZONTAL_PADDING_PERCENT}%;vertical-align:top;overflow:hidden;">'
            f'{player_identity_html(player)}</td>'
            f'<td class="email-change-cell" style="width:{IMPROVEMENT_COLUMN_WIDTH_PERCENT}%;padding:{EMAIL_ROW_VERTICAL_PADDING_PERCENT}% {EMAIL_ROW_HORIZONTAL_PADDING_PERCENT}%;vertical-align:top;color:#52697a;line-height:1.45;white-space:normal;overflow-wrap:anywhere;font-size:82%;">'
            f'{format_html_changes(player)}</td>'
            '</tr>'
        )

    rendered = f"""
<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>{html.escape(scope_name)} improvements</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Titillium+Web:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
      :root {{ color-scheme: light dark; supported-color-schemes: light dark; }}
      .email-card {{ font-size:{EMAIL_DESKTOP_FONT_SIZE_PX}px; }}
      .email-id-cell, .email-id-link {{ white-space:nowrap; overflow-wrap:normal; word-break:normal; }}
      .email-player-portrait {{ height:{EMAIL_PORTRAIT_DISPLAY_HEIGHT_PX}px; width:auto; max-width:none; }}
      @media screen and (max-width:480px) {{
        .email-card {{ font-size:{EMAIL_MOBILE_FONT_SIZE_PX}px; }}
        .email-player-portrait {{ height:{EMAIL_PORTRAIT_MOBILE_DISPLAY_HEIGHT_PX}px; }}
      }}
      @media screen and (max-width:360px) {{
        .email-card {{ font-size:{EMAIL_COMPACT_FONT_SIZE_PX}px; }}
        .email-player-portrait {{ height:{EMAIL_PORTRAIT_COMPACT_DISPLAY_HEIGHT_PX}px; }}
      }}
      @media (prefers-color-scheme: dark) {{
        .email-body, .email-page {{ background:#0f151a !important; color:#eef6ff !important; }}
        .email-card {{ background:#141c23 !important; border-color:#2d3a45 !important; }}
        .email-hero {{ background:#182630 !important; border-color:#2d3a45 !important; }}
        .email-table {{ border-color:#2d3a45 !important; }}
        .email-table-head {{ background:#202c35 !important; color:#ffffff !important; }}
        .email-player-row {{ background:#141c23 !important; border-color:#2d3a45 !important; }}
        .email-title, .email-player-name, .email-value {{ color:#ffffff !important; }}
        .email-muted, .email-change, .email-change-cell {{ color:#bdd0df !important; }}
        .email-position, .email-footer {{ color:#8fa6b8 !important; }}
        .email-brand, .email-link {{ color:#54d3ff !important; }}
        .email-delta {{ color:#2fbf62 !important; }}
      }}
      [data-ogsc] .email-title, [data-ogsc] .email-player-name, [data-ogsc] .email-value {{ color:#ffffff !important; }}
      [data-ogsc] .email-muted, [data-ogsc] .email-change, [data-ogsc] .email-change-cell {{ color:#bdd0df !important; }}
      [data-ogsc] .email-position, [data-ogsc] .email-footer {{ color:#8fa6b8 !important; }}
      [data-ogsc] .email-brand, [data-ogsc] .email-link {{ color:#54d3ff !important; }}
      [data-ogsc] .email-delta {{ color:#2fbf62 !important; }}
      [data-ogsb] .email-page {{ background:#0f151a !important; }}
      [data-ogsb] .email-card, [data-ogsb] .email-player-row {{ background:#141c23 !important; }}
      [data-ogsb] .email-hero {{ background:#182630 !important; }}
      [data-ogsb] .email-table-head {{ background:#202c35 !important; }}
    </style>
  </head>
  <body class="email-body" style="margin:0;background:#f3f6f8;color:#17222b;font-family:'Titillium Web',Arial,Helvetica,sans-serif;font-size:100%;">
    <table class="email-page" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#f3f6f8;padding:4% {EMAIL_PAGE_HORIZONTAL_PADDING_PERCENT}%;font-family:'Titillium Web',Arial,Helvetica,sans-serif;">
      <tr>
        <td align="center">
          <table class="email-card" role="presentation" width="{EMAIL_CARD_WIDTH_PERCENT}%" cellspacing="0" cellpadding="0" style="width:{EMAIL_CARD_WIDTH_PERCENT}%;background:#ffffff;border:1px solid #cbd7df;border-radius:2%;overflow:hidden;">
            <tr>
              <td class="email-hero" style="padding:4% {EMAIL_CARD_HORIZONTAL_PADDING_PERCENT}%;background:#edf4f8;border-bottom:1px solid #cbd7df;">
                <div class="email-brand" style="font-size:75%;letter-spacing:.14em;text-transform:uppercase;color:#007ca8;font-weight:800;">MFL Front Office</div>
                <h1 class="email-title" style="margin:.35em 0 0;font-size:175%;line-height:1.15;color:#17222b;">Player improvements</h1>
                <p class="email-muted" style="margin:.65em 0 0;color:#52697a;font-size:94%;">{html.escape(scope_name)} has {len(players)} improved {'player' if len(players) == 1 else 'players'} after the latest refresh.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:4% {EMAIL_CARD_HORIZONTAL_PADDING_PERCENT}%;">
                <table class="email-table" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;border:1px solid #cbd7df;border-radius:1.5%;overflow:hidden;table-layout:fixed;">
                  <colgroup>
                    <col style="width:{ID_COLUMN_WIDTH_PERCENT}%;">
                    <col style="width:{PLAYER_COLUMN_WIDTH_PERCENT}%;">
                    <col style="width:{IMPROVEMENT_COLUMN_WIDTH_PERCENT}%;">
                  </colgroup>
                  <thead>
                    <tr class="email-table-head" style="background:#e7eef3;color:#17222b;text-align:left;font-size:75%;text-transform:uppercase;letter-spacing:.04em;">
                      <th style="width:{ID_COLUMN_WIDTH_PERCENT}%;padding:2.5% {EMAIL_ROW_HORIZONTAL_PADDING_PERCENT}%;">ID</th>
                      <th style="width:{PLAYER_COLUMN_WIDTH_PERCENT}%;padding:2.5% {EMAIL_ROW_HORIZONTAL_PADDING_PERCENT}%;">Player</th>
                      <th style="width:{IMPROVEMENT_COLUMN_WIDTH_PERCENT}%;padding:2.5% {EMAIL_ROW_HORIZONTAL_PADDING_PERCENT}%;">Improvement</th>
                    </tr>
                  </thead>
                  <tbody style="font-size:87.5%;color:#17222b;">{''.join(rows)}</tbody>
                </table>
                <p class="email-footer" style="margin:1.25em 0 0;color:#60778a;font-size:75%;line-height:1.5;">You received this because this notification is enabled in Settings. <a class="email-link" style="color:#007ca8;text-decoration:none;" href="https://mfl-front-office.vercel.app/settings">Unsubscribe or manage emails</a>.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""
    return apply_email_theme(rendered, theme)

def build_email_message(
    recipient: str,
    subject: str,
    text_body: str,
    html_body: str,
    _players: list[PlayerImprovement] | tuple[PlayerImprovement, ...] = (),
) -> EmailMessage:
    message = EmailMessage()
    message["From"] = os.environ["EMAIL_FROM"]
    message["To"] = recipient
    message["Subject"] = subject
    if os.environ.get("EMAIL_REPLY_TO"):
        message["Reply-To"] = os.environ["EMAIL_REPLY_TO"]
    message.set_content(text_body)
    # Keep portraits as remote HTTPS resources. Adding them as related MIME image
    # parts makes Gmail surface the portraits as email attachments.
    message.add_alternative(html_body, subtype="html")
    return message


def send_email(
    recipient: str,
    subject: str,
    text_body: str,
    html_body: str,
    players: list[PlayerImprovement] | tuple[PlayerImprovement, ...] = (),
) -> None:
    message = build_email_message(
        recipient,
        subject,
        text_body,
        html_body,
        players,
    )

    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT") or "587")
    username = os.environ["SMTP_USERNAME"]
    password = os.environ["SMTP_PASSWORD"]

    if port == 465:
        with smtplib.SMTP_SSL(
            host,
            port,
            context=ssl.create_default_context(),
            timeout=30,
        ) as smtp:
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


def notification_jobs(
    preferences: list[dict[str, Any]],
    improvements: dict[str, PlayerImprovement],
) -> list[tuple[str, str, list[PlayerImprovement], str]]:
    jobs: list[tuple[str, str, list[PlayerImprovement], str]] = []
    improvements_by_owner: dict[str, list[PlayerImprovement]] = {}
    for player in improvements.values():
        improvements_by_owner.setdefault(player.wallet_address, []).append(player)

    for preference in preferences:
        wallet = normalize_wallet(preference.get("wallet_address"))
        settings = (
            preference.get("settings")
            if isinstance(preference.get("settings"), dict)
            else {}
        )
        recipient = str(
            settings.get("emailAddress") or settings.get("email_address") or ""
        ).strip()
        enabled = set(
            settings.get("receiveEmailsFor")
            if isinstance(settings.get("receiveEmailsFor"), list)
            else []
        )
        if not recipient or not enabled:
            continue
        theme = normalize_email_theme(settings.get("theme"))

        if "myplayers" in enabled:
            players = unique_players(improvements_by_owner.get(wallet, []))
            if players:
                jobs.append((recipient, "My Players", players, theme))

        watchlists = (
            preference.get("watchlists")
            if isinstance(preference.get("watchlists"), list)
            else []
        )
        for watchlist in watchlists:
            if not isinstance(watchlist, dict):
                continue
            watchlist_id = str(watchlist.get("id") or "").strip()
            if not watchlist_id or f"watchlist-{watchlist_id}" not in enabled:
                continue
            player_ids = {
                str(player_id)
                for player_id in (watchlist.get("playerIds") or [])
            }
            players = unique_players(
                [
                    improvements[player_id]
                    for player_id in player_ids
                    if player_id in improvements
                ]
            )
            if players:
                name = (
                    str(watchlist.get("name") or "Watchlist").strip()
                    or "Watchlist"
                )
                jobs.append((recipient, f"Watchlist {name}", players, theme))

    return jobs


def preview_player_from_row(player_id: str, current: dict[str, Any]) -> PlayerImprovement:
    changes: list[tuple[str, int, int]] = []
    for column in STAT_COLUMNS:
        new_value = parse_int(current.get(column))
        if new_value is None or new_value <= 0:
            continue
        changes.append((column, max(0, new_value - 1), new_value))
        if len(changes) == 4:
            break
    if not changes:
        changes.append(("overall", 0, 1))

    overall_change = next(
        (
            (old_value, new_value)
            for column, old_value, new_value in changes
            if column == "overall"
        ),
        None,
    )
    return PlayerImprovement(
        player_id=player_id,
        name=str(current.get("name") or f"Player {player_id}"),
        wallet_address=normalize_wallet(current.get("wallet_address")),
        wallet_name=str(current.get("wallet_name") or current.get("wallet_address") or ""),
        positions=str(current.get("positions") or ""),
        old_overall=(
            overall_change[0]
            if overall_change
            else parse_int(current.get("overall"))
        ),
        new_overall=(
            overall_change[1]
            if overall_change
            else parse_int(current.get("overall"))
        ),
        changes=tuple(changes),
    )


def parse_preview_player_ids(single_player_id: str, player_ids_csv: str) -> list[str]:
    requested: list[str] = []
    if str(single_player_id or "").strip():
        requested.append(str(single_player_id).strip())
    requested.extend(
        player_id.strip()
        for player_id in str(player_ids_csv or "").split(",")
        if player_id.strip()
    )

    seen: set[str] = set()
    unique: list[str] = []
    for player_id in requested:
        if player_id in seen:
            continue
        seen.add(player_id)
        unique.append(player_id)
    return unique


def preview_players_from_database(
    current_db: Path,
    requested_player_ids: list[str],
) -> list[PlayerImprovement]:
    players = load_players(current_db)
    if not players:
        raise RuntimeError("Current database contains no players to preview.")

    player_ids = list(requested_player_ids)
    if not player_ids:
        player_ids = [
            max(players, key=lambda value: int(value) if value.isdigit() else -1)
        ]

    missing = [player_id for player_id in player_ids if player_id not in players]
    if missing:
        label = ", ".join(missing)
        raise RuntimeError(
            f"Player{'s' if len(missing) != 1 else ''} {label} "
            f"{'were' if len(missing) != 1 else 'was'} not found in {current_db}."
        )

    return [
        preview_player_from_row(player_id, players[player_id])
        for player_id in player_ids
    ]


def preview_player_from_database(
    current_db: Path,
    requested_player_id: str,
) -> PlayerImprovement:
    """Backward-compatible single-player preview helper."""
    return preview_players_from_database(
        current_db,
        [requested_player_id] if requested_player_id else [],
    )[0]


def write_preview(
    current_db: Path,
    output_path: Path,
    requested_player_id: str = "",
    requested_player_ids: str = "",
) -> None:
    player_ids = parse_preview_player_ids(
        requested_player_id,
        requested_player_ids,
    )
    players = preview_players_from_database(current_db, player_ids)
    hydrated = attach_player_portraits(
        {player.player_id: player for player in players}
    )
    rendered_players = [
        hydrated[player.player_id]
        for player in players
    ]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        build_html("Test Email", rendered_players),
        encoding="utf-8",
    )
    print(
        f"Wrote progression email preview to {output_path} "
        f"with {len(rendered_players)} player"
        f"{'s' if len(rendered_players) != 1 else ''}. No email was sent."
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Send MFL Front Office progression improvement emails."
    )
    parser.add_argument(
        "--previous-db",
        default="previous-database/mfl_progression.db",
    )
    parser.add_argument("--current-db", default="mfl_progression.db")
    parser.add_argument(
        "--portrait-cache",
        default="",
        help="Deprecated compatibility option; portraits are derived directly from player IDs.",
    )
    parser.add_argument(
        "--preview-output",
        help="Write a browser-viewable HTML preview and exit without Supabase or SMTP.",
    )
    parser.add_argument(
        "--preview-player-id",
        default="",
        help="Single player ID to use in preview mode.",
    )
    parser.add_argument(
        "--preview-player-ids",
        default="",
        help=(
            "Comma-separated player IDs to render together in one preview email. "
            "Can be combined with --preview-player-id. If neither option is used, "
            "the highest player ID in the current database is previewed."
        ),
    )
    args = parser.parse_args()

    current_db = Path(args.current_db)
    if args.preview_output:
        if not current_db.exists():
            print(
                f"Progression email preview skipped: "
                f"current database not found at {current_db}."
            )
            return 1
        try:
            write_preview(
                current_db,
                Path(args.preview_output),
                args.preview_player_id,
                args.preview_player_ids,
            )
        except RuntimeError as error:
            print(f"Progression email preview failed: {error}")
            return 1
        return 0

    previous_db = Path(args.previous_db)
    if not previous_db.exists():
        print(
            f"Progression emails skipped: "
            f"previous database not found at {previous_db}."
        )
        return 0
    if not current_db.exists():
        print(
            f"Progression emails skipped: "
            f"current database not found at {current_db}."
        )
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
    improvements = attach_player_portraits(improvements)

    try:
        preferences = load_preferences()
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
        print(
            f"Progression emails skipped: "
            f"could not read Supabase preferences: {error}"
        )
        return 0

    jobs = notification_jobs(preferences, improvements)
    if not jobs:
        print(
            f"Found {len(improvements)} improved players, "
            "but no enabled email scopes matched them."
        )
        return 0

    sent = 0
    for recipient, scope_name, players, theme in jobs:
        try:
            send_email(
                recipient,
                build_subject(scope_name, players),
                build_text(scope_name, players),
                build_html(scope_name, players, theme),
                players,
            )
            sent += 1
            print(
                f"Sent {scope_name} progression email to {recipient} "
                f"with {len(players)} players."
            )
        except Exception as error:  # noqa: BLE001 - keep database workflows alive if email delivery fails.
            print(
                f"Could not send {scope_name} progression email "
                f"to {recipient}: {error}"
            )

    print(
        f"Progression email notifications complete: "
        f"{sent}/{len(jobs)} emails sent."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
