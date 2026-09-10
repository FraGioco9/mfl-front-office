from __future__ import annotations

"""Normalized permanent storage for official MFL competition history."""

import json
import re
import sqlite3
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

FIRST_SEASON_ID = 11
PLAYOFF_CODE_PREFIX = "P:"
FINAL_MATCH_STATUSES = frozenset({"ENDED", "FORFEITED", "CANCELED", "CANCELLED"})
PARTICIPANT_REQUIRED_MATCH_STATUSES = frozenset({"ENDED", "FORFEITED"})
RANK_RANGE_PATTERN = re.compile(r"^\s*(\d+)\s*(?:[-–—]\s*(\d+))?\s*$")
REWARD_AMOUNT_PATTERN = re.compile(
    r"^\s*([+-]?\d+(?:[.,]\d+)?)\s*(?:\$?MFL)?\s*$",
    re.IGNORECASE,
)
COMPETITION_TABLES = (
    "competitions",
    "competition_stages",
    "competition_groups",
    "competition_rounds",
    "competition_standings",
    "competition_rewards",
    "competition_matches",
)

Log = Callable[[str], None]


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _mapping(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _items(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _int(value: Any) -> int | None:
    try:
        return None if value in (None, "") else int(value)
    except (TypeError, ValueError):
        return None


def _float(value: Any) -> float | None:
    try:
        return None if value in (None, "") else float(value)
    except (TypeError, ValueError):
        return None


def _truthy(value: Any) -> bool:
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes"}
    return bool(value)


def _first(mapping: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = mapping.get(key)
        if value is not None:
            return value
    return None


def _api_id(value: Any) -> str:
    if isinstance(value, dict):
        value = value.get("id")
    return _text(value)


def _club_id(value: Any) -> int | None:
    direct = _int(value)
    if direct is not None:
        return direct
    node = _mapping(value)
    if not node:
        return None
    for key in ("clubId", "club_id"):
        resolved = _int(node.get(key))
        if resolved is not None:
            return resolved
    if "club" in node:
        resolved = _club_id(node.get("club"))
        if resolved is not None:
            return resolved
    return _int(node.get("id"))


def _match_club_id(match: dict[str, Any], side: str) -> int | None:
    direct = _first(
        match,
        f"{side}ClubId",
        f"{side}_club_id",
        f"{side}Club",
        f"{side}_club",
    )
    club_id = _club_id(direct)
    if club_id is not None:
        return club_id
    squad = _first(match, f"{side}Squad", f"{side}_squad")
    return _club_id(squad)


def _season_id(detail: dict[str, Any]) -> int | None:
    season = detail.get("season")
    if isinstance(season, dict):
        resolved = _int(season.get("id"))
        if resolved is not None:
            return resolved
    return _int(detail.get("seasonId"))


def _root_id(detail: dict[str, Any], fallback: int | None) -> int | None:
    root = detail.get("root")
    if isinstance(root, dict):
        resolved = _int(root.get("id"))
        if resolved is not None:
            return resolved
    return fallback


def is_playoff(detail: dict[str, Any]) -> bool:
    code = _text(detail.get("code")).upper()
    if code.startswith(PLAYOFF_CODE_PREFIX):
        return True
    return _text(detail.get("name")).lower().find("playoff") >= 0


def is_eligible_detail(detail: Any) -> bool:
    return (
        isinstance(detail, dict)
        and _truthy(detail.get("withXp"))
        and not is_playoff(detail)
        and (_season_id(detail) or 0) >= FIRST_SEASON_ID
    )


def create_schema(connection: sqlite3.Connection) -> None:
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS competitions (
          competition_id INTEGER PRIMARY KEY,
          root_competition_id INTEGER,
          season_id INTEGER NOT NULL,
          type TEXT NOT NULL DEFAULT '',
          subtype TEXT NOT NULL DEFAULT '',
          name TEXT NOT NULL DEFAULT '',
          code TEXT NOT NULL DEFAULT '',
          primary_color TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT '',
          with_xp INTEGER NOT NULL CHECK(with_xp IN (0, 1)),
          prize_pool TEXT NOT NULL DEFAULT '',
          starting_date TEXT NOT NULL DEFAULT '',
          detail_loaded INTEGER NOT NULL DEFAULT 0 CHECK(detail_loaded IN (0, 1)),
          refreshed_at TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS competitions_season_index
          ON competitions(season_id, type, code, competition_id);

        CREATE TABLE IF NOT EXISTS competition_stages (
          competition_id INTEGER NOT NULL REFERENCES competitions(competition_id) ON DELETE CASCADE,
          stage_order INTEGER NOT NULL,
          stage_api_id TEXT NOT NULL DEFAULT '',
          stage_type TEXT NOT NULL DEFAULT '',
          name TEXT NOT NULL DEFAULT '',
          PRIMARY KEY (competition_id, stage_order)
        );

        CREATE TABLE IF NOT EXISTS competition_groups (
          competition_id INTEGER NOT NULL REFERENCES competitions(competition_id) ON DELETE CASCADE,
          stage_order INTEGER NOT NULL,
          group_order INTEGER NOT NULL,
          group_api_id TEXT NOT NULL DEFAULT '',
          name TEXT NOT NULL DEFAULT '',
          PRIMARY KEY (competition_id, stage_order, group_order)
        );

        CREATE TABLE IF NOT EXISTS competition_rounds (
          competition_id INTEGER NOT NULL REFERENCES competitions(competition_id) ON DELETE CASCADE,
          stage_order INTEGER NOT NULL,
          group_order INTEGER NOT NULL,
          round_order INTEGER NOT NULL,
          round_api_id TEXT NOT NULL DEFAULT '',
          name TEXT NOT NULL DEFAULT '',
          PRIMARY KEY (competition_id, stage_order, group_order, round_order)
        );

        CREATE TABLE IF NOT EXISTS competition_standings (
          competition_id INTEGER NOT NULL REFERENCES competitions(competition_id) ON DELETE CASCADE,
          stage_order INTEGER NOT NULL,
          group_order INTEGER NOT NULL,
          club_id INTEGER NOT NULL,
          position INTEGER NOT NULL,
          wins INTEGER NOT NULL DEFAULT 0,
          draws INTEGER NOT NULL DEFAULT 0,
          losses INTEGER NOT NULL DEFAULT 0,
          goals INTEGER NOT NULL DEFAULT 0,
          goals_against INTEGER NOT NULL DEFAULT 0,
          points REAL NOT NULL DEFAULT 0,
          PRIMARY KEY (competition_id, stage_order, group_order, club_id)
        );
        CREATE INDEX IF NOT EXISTS competition_standings_club_index
          ON competition_standings(club_id, competition_id);

        CREATE TABLE IF NOT EXISTS competition_rewards (
          competition_id INTEGER NOT NULL REFERENCES competitions(competition_id) ON DELETE CASCADE,
          reward_order INTEGER NOT NULL,
          placement_from INTEGER,
          placement_to INTEGER,
          reward_label TEXT NOT NULL DEFAULT '',
          reward_amount REAL,
          raw_value TEXT NOT NULL DEFAULT '',
          PRIMARY KEY (competition_id, reward_order)
        );

        CREATE TABLE IF NOT EXISTS competition_matches (
          match_id INTEGER PRIMARY KEY,
          competition_id INTEGER NOT NULL REFERENCES competitions(competition_id) ON DELETE CASCADE,
          stage_order INTEGER NOT NULL,
          group_order INTEGER NOT NULL,
          round_order INTEGER NOT NULL,
          start_date TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT '',
          home_club_id INTEGER,
          away_club_id INTEGER,
          home_score INTEGER,
          away_score INTEGER,
          home_penalty_score INTEGER,
          away_penalty_score INTEGER
        );
        CREATE INDEX IF NOT EXISTS competition_matches_competition_index
          ON competition_matches(competition_id, start_date, match_id);
        CREATE INDEX IF NOT EXISTS competition_matches_home_club_index
          ON competition_matches(home_club_id, start_date, match_id);
        CREATE INDEX IF NOT EXISTS competition_matches_away_club_index
          ON competition_matches(away_club_id, start_date, match_id);
        """
    )
    connection.commit()


def _table_names(connection: sqlite3.Connection, schema: str = "main") -> set[str]:
    safe_schema = schema.replace('"', '""')
    return {
        str(row[0])
        for row in connection.execute(
            f'SELECT name FROM "{safe_schema}".sqlite_master WHERE type = \'table\''
        ).fetchall()
    }


def _table_columns(
    connection: sqlite3.Connection,
    table: str,
    schema: str = "main",
) -> list[str]:
    safe_schema = schema.replace('"', '""')
    safe_table = table.replace('"', '""')
    return [
        str(row[1])
        for row in connection.execute(
            f'PRAGMA "{safe_schema}".table_info("{safe_table}")'
        ).fetchall()
    ]


def restore_previous_history(
    connection: sqlite3.Connection,
    previous_database_path: Path | None,
    log: Log = print,
) -> int:
    """Copy already-ingested competition history into a fresh rebuild database."""
    create_schema(connection)
    if previous_database_path is None or not previous_database_path.is_file():
        log("Competition history restored from previous database: 0 competitions")
        return 0

    alias = "previous_competitions"
    connection.execute(f"ATTACH DATABASE ? AS {alias}", (str(previous_database_path),))
    try:
        previous_tables = _table_names(connection, alias)
        for table in COMPETITION_TABLES:
            if table not in previous_tables:
                continue
            current_columns = _table_columns(connection, table)
            previous_columns = set(_table_columns(connection, table, alias))
            columns = [column for column in current_columns if column in previous_columns]
            if not columns:
                continue
            quoted = ", ".join(f'"{column}"' for column in columns)
            connection.execute(
                f'INSERT OR IGNORE INTO "{table}" ({quoted}) '
                f'SELECT {quoted} FROM {alias}."{table}"'
            )
        connection.commit()
    finally:
        connection.execute(f"DETACH DATABASE {alias}")

    restored = int(connection.execute("SELECT COUNT(*) FROM competitions").fetchone()[0])
    log(f"Competition history restored from previous database: {restored} competitions")
    return restored


def stored_competition_ids(connection: sqlite3.Connection) -> set[int]:
    create_schema(connection)
    return {
        int(row[0])
        for row in connection.execute(
            "SELECT competition_id FROM competitions WHERE detail_loaded = 1"
        ).fetchall()
    }


def max_stored_season_id(connection: sqlite3.Connection) -> int | None:
    row = connection.execute("SELECT max(season_id) FROM competitions").fetchone()
    return _int(row[0]) if row else None


def _standing_rows(group: dict[str, Any]) -> list[dict[str, Any]]:
    for key in ("standings", "ranking", "rankings", "table"):
        rows = group.get(key)
        if isinstance(rows, list):
            return [row for row in rows if isinstance(row, dict)]
    return []


def _standing_club_id(row: dict[str, Any]) -> int | None:
    for key in ("club", "squad"):
        club_id = _club_id(row.get(key))
        if club_id is not None:
            return club_id
    return _club_id(_first(row, "clubId", "club_id"))


def _placement_range(value: Any) -> tuple[int | None, int | None]:
    text = _text(value)
    if not text:
        return None, None
    match = RANK_RANGE_PATTERN.fullmatch(text)
    if match is None:
        return None, None
    placement_from = int(match.group(1))
    placement_to = int(match.group(2) or match.group(1))
    return placement_from, placement_to


def _reward_amount(value: Any) -> float | None:
    direct = _float(value)
    if direct is not None:
        return direct
    text = _text(value)
    match = REWARD_AMOUNT_PATTERN.fullmatch(text)
    if match is None:
        return None
    return _float(match.group(1).replace(",", "."))


def _reward_fields(value: Any) -> tuple[int | None, int | None, str, float | None]:
    if not isinstance(value, dict):
        text = _text(value)
        return None, None, text, _reward_amount(value)

    placement_from, placement_to = _placement_range(
        _first(value, "ranks", "rank", "position")
    )
    if placement_from is None:
        placement_from = _int(_first(value, "from", "minRank", "startRank"))
        placement_to = _int(_first(value, "to", "maxRank", "endRank")) or placement_from

    lines = value.get("lines")
    if isinstance(lines, list):
        line_values = [_text(line) for line in lines if _text(line)]
        reward: Any = " · ".join(line_values)
    else:
        reward = _first(value, "reward", "prize", "value", "amount", "label")

    if isinstance(reward, dict):
        label = _text(_first(reward, "label", "name", "value", "amount"))
        amount = _reward_amount(_first(reward, "amount", "value"))
    else:
        label = _text(reward)
        amount = _reward_amount(reward)
    return placement_from, placement_to, label, amount


def _replace_rewards(
    connection: sqlite3.Connection,
    competition_id: int,
    detail: dict[str, Any],
) -> None:
    connection.execute(
        "DELETE FROM competition_rewards WHERE competition_id = ?",
        (competition_id,),
    )
    for index, reward in enumerate(_items(detail.get("rewards"))):
        placement_from, placement_to, label, amount = _reward_fields(reward)
        raw_value = json.dumps(reward, separators=(",", ":"), ensure_ascii=False)
        connection.execute(
            """
            INSERT INTO competition_rewards (
              competition_id, reward_order, placement_from, placement_to,
              reward_label, reward_amount, raw_value
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                competition_id,
                index,
                placement_from,
                placement_to,
                label,
                amount,
                raw_value,
            ),
        )


def _insert_standings(
    connection: sqlite3.Connection,
    competition_id: int,
    stage_order: int,
    group_order: int,
    group: dict[str, Any],
) -> None:
    for index, row in enumerate(_standing_rows(group), start=1):
        club_id = _standing_club_id(row)
        if club_id is None:
            continue
        position = _int(_first(row, "position", "rank", "ranking")) or index
        connection.execute(
            """
            INSERT INTO competition_standings (
              competition_id, stage_order, group_order, club_id, position,
              wins, draws, losses, goals, goals_against, points
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                competition_id,
                stage_order,
                group_order,
                club_id,
                position,
                _int(row.get("wins")) or 0,
                _int(row.get("draws")) or 0,
                _int(row.get("losses")) or 0,
                _int(row.get("goals")) or 0,
                _int(_first(row, "goalsAgainst", "goals_against")) or 0,
                _float(row.get("points")) or 0,
            ),
        )


def _rounds(stage: dict[str, Any], group: dict[str, Any] | None) -> list[dict[str, Any]]:
    source = group if group is not None else stage
    return [item for item in _items(source.get("rounds")) if isinstance(item, dict)]


def _upsert_match(
    connection: sqlite3.Connection,
    competition_id: int,
    stage_order: int,
    group_order: int,
    round_order: int,
    match: dict[str, Any],
) -> int | None:
    match_id = _int(_first(match, "matchId", "id"))
    if match_id is None:
        return None
    connection.execute(
        """
        INSERT INTO competition_matches (
          match_id, competition_id, stage_order, group_order, round_order,
          start_date, status, home_club_id, away_club_id,
          home_score, away_score, home_penalty_score, away_penalty_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(match_id) DO UPDATE SET
          competition_id = excluded.competition_id,
          stage_order = excluded.stage_order,
          group_order = excluded.group_order,
          round_order = excluded.round_order,
          start_date = excluded.start_date,
          status = excluded.status,
          home_club_id = excluded.home_club_id,
          away_club_id = excluded.away_club_id,
          home_score = excluded.home_score,
          away_score = excluded.away_score,
          home_penalty_score = excluded.home_penalty_score,
          away_penalty_score = excluded.away_penalty_score
        """,
        (
            match_id,
            competition_id,
            stage_order,
            group_order,
            round_order,
            _text(_first(match, "startDate", "date", "startingDate")),
            _text(match.get("status")).upper(),
            _match_club_id(match, "home"),
            _match_club_id(match, "away"),
            _int(match.get("homeScore")),
            _int(match.get("awayScore")),
            _int(match.get("homePenaltyScore")),
            _int(match.get("awayPenaltyScore")),
        ),
    )
    return match_id


def _replace_structure(
    connection: sqlite3.Connection,
    competition_id: int,
    stages: list[dict[str, Any]],
) -> set[int]:
    for table in (
        "competition_stages",
        "competition_groups",
        "competition_rounds",
        "competition_standings",
    ):
        connection.execute(f"DELETE FROM {table} WHERE competition_id = ?", (competition_id,))

    seen_matches: set[int] = set()
    for stage_order, stage in enumerate(stages):
        stage_type = _text(stage.get("type")).upper()
        connection.execute(
            """
            INSERT INTO competition_stages (
              competition_id, stage_order, stage_api_id, stage_type, name
            ) VALUES (?, ?, ?, ?, ?)
            """,
            (
                competition_id,
                stage_order,
                _api_id(stage),
                stage_type,
                _text(_first(stage, "name", "label")),
            ),
        )

        groups = [item for item in _items(stage.get("groups")) if isinstance(item, dict)]
        if groups:
            for group_order, group in enumerate(groups):
                connection.execute(
                    """
                    INSERT INTO competition_groups (
                      competition_id, stage_order, group_order, group_api_id, name
                    ) VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        competition_id,
                        stage_order,
                        group_order,
                        _api_id(group),
                        _text(_first(group, "name", "label")),
                    ),
                )
                _insert_standings(connection, competition_id, stage_order, group_order, group)
                for round_order, round_data in enumerate(_rounds(stage, group)):
                    _insert_round_and_matches(
                        connection,
                        competition_id,
                        stage_order,
                        group_order,
                        round_order,
                        round_data,
                        seen_matches,
                    )
        else:
            for round_order, round_data in enumerate(_rounds(stage, None)):
                _insert_round_and_matches(
                    connection,
                    competition_id,
                    stage_order,
                    -1,
                    round_order,
                    round_data,
                    seen_matches,
                )
    return seen_matches


def _insert_round_and_matches(
    connection: sqlite3.Connection,
    competition_id: int,
    stage_order: int,
    group_order: int,
    round_order: int,
    round_data: dict[str, Any],
    seen_matches: set[int],
) -> None:
    connection.execute(
        """
        INSERT INTO competition_rounds (
          competition_id, stage_order, group_order, round_order, round_api_id, name
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            competition_id,
            stage_order,
            group_order,
            round_order,
            _api_id(round_data),
            _text(_first(round_data, "name", "label")),
        ),
    )
    for match in _items(round_data.get("matches")):
        if not isinstance(match, dict):
            continue
        match_id = _upsert_match(
            connection,
            competition_id,
            stage_order,
            group_order,
            round_order,
            match,
        )
        if match_id is not None:
            seen_matches.add(match_id)


def _reconcile_missing_matches(
    connection: sqlite3.Connection,
    competition_id: int,
    seen_matches: set[int],
    log: Log,
) -> tuple[int, int]:
    removed = 0
    preserved = 0
    rows = connection.execute(
        "SELECT match_id, status FROM competition_matches WHERE competition_id = ?",
        (competition_id,),
    ).fetchall()
    for raw_match_id, raw_status in rows:
        match_id = int(raw_match_id)
        if match_id in seen_matches:
            continue
        status = _text(raw_status).upper()
        if status in FINAL_MATCH_STATUSES:
            preserved += 1
            log(
                f"Competition {competition_id}: completed match {match_id} disappeared "
                "from the schedule; preserving it for history."
            )
            continue
        connection.execute("DELETE FROM competition_matches WHERE match_id = ?", (match_id,))
        removed += 1
    return removed, preserved


def _first_unresolved_match_keys(stages: list[dict[str, Any]]) -> list[str]:
    for stage in stages:
        groups = [item for item in _items(stage.get("groups")) if isinstance(item, dict)]
        owners = groups or [stage]
        for owner in owners:
            for round_data in _rounds(stage, owner if owner is not stage else None):
                for match in _items(round_data.get("matches")):
                    if not isinstance(match, dict):
                        continue
                    status = _text(match.get("status")).upper()
                    if status not in PARTICIPANT_REQUIRED_MATCH_STATUSES:
                        continue
                    if _match_club_id(match, "home") is None or _match_club_id(match, "away") is None:
                        return sorted(str(key) for key in match)
    return []


def _validate_match_participants(
    connection: sqlite3.Connection,
    competition_id: int,
    stages: list[dict[str, Any]],
    log: Log,
) -> None:
    placeholders = ", ".join("?" for _ in PARTICIPANT_REQUIRED_MATCH_STATUSES)
    statuses = tuple(sorted(PARTICIPANT_REQUIRED_MATCH_STATUSES))
    total, complete, missing_home, missing_away = connection.execute(
        f"""
        SELECT
          count(*),
          sum(CASE WHEN home_club_id IS NOT NULL AND away_club_id IS NOT NULL THEN 1 ELSE 0 END),
          sum(CASE WHEN home_club_id IS NULL THEN 1 ELSE 0 END),
          sum(CASE WHEN away_club_id IS NULL THEN 1 ELSE 0 END)
        FROM competition_matches
        WHERE competition_id = ? AND status IN ({placeholders})
        """,
        (competition_id, *statuses),
    ).fetchone()
    total = int(total or 0)
    complete = int(complete or 0)
    missing_home = int(missing_home or 0)
    missing_away = int(missing_away or 0)
    if total and complete == 0:
        keys = _first_unresolved_match_keys(stages)
        signature = ", ".join(keys) if keys else "<unavailable>"
        raise RuntimeError(
            f"Competition {competition_id} normalized 0/{total} ended/forfeited matches "
            f"with both club IDs; match payload keys: {signature}"
        )
    if total and (missing_home or missing_away):
        log(
            f"Competition {competition_id}: participant coverage {complete}/{total} "
            f"ended/forfeited matches complete; missing home {missing_home}, "
            f"missing away {missing_away}."
        )


def persist_competition_detail(
    connection: sqlite3.Connection,
    detail: Any,
    *,
    root_competition_id: int | None = None,
    discovery_primary_color: str = "",
    log: Log = print,
) -> bool:
    """Atomically persist one canonical official non-playoff competition detail."""
    if not is_eligible_detail(detail):
        return False
    assert isinstance(detail, dict)

    competition_id = _int(detail.get("id"))
    season_id = _season_id(detail)
    if competition_id is None or season_id is None:
        raise RuntimeError("Eligible competition detail was missing id or season")

    schedule = _mapping(detail.get("schedule"))
    raw_stages = schedule.get("stages")
    stages = [item for item in _items(raw_stages) if isinstance(item, dict)]
    has_schedule = isinstance(raw_stages, list)
    refreshed_at = _utc_now()

    with connection:
        connection.execute(
            """
            INSERT INTO competitions (
              competition_id, root_competition_id, season_id, type, subtype,
              name, code, primary_color, status, with_xp, prize_pool,
              starting_date, detail_loaded, refreshed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 1, ?)
            ON CONFLICT(competition_id) DO UPDATE SET
              root_competition_id = excluded.root_competition_id,
              season_id = excluded.season_id,
              type = excluded.type,
              subtype = excluded.subtype,
              name = excluded.name,
              code = excluded.code,
              primary_color = excluded.primary_color,
              status = excluded.status,
              with_xp = 1,
              prize_pool = excluded.prize_pool,
              starting_date = excluded.starting_date,
              detail_loaded = 1,
              refreshed_at = excluded.refreshed_at
            """,
            (
                competition_id,
                _root_id(detail, root_competition_id),
                season_id,
                _text(detail.get("type")),
                _text(_first(detail, "subType", "subtype")),
                _text(detail.get("name")),
                _text(detail.get("code")),
                _text(detail.get("primaryColor")) or discovery_primary_color,
                _text(detail.get("status")).upper(),
                _text(detail.get("prizePool")),
                _text(detail.get("startingDate")),
                refreshed_at,
            ),
        )
        _replace_rewards(connection, competition_id, detail)
        if has_schedule:
            seen_matches = _replace_structure(connection, competition_id, stages)
            _reconcile_missing_matches(connection, competition_id, seen_matches, log)
            _validate_match_participants(connection, competition_id, stages, log)
        else:
            log(
                f"Competition {competition_id}: detail had no schedule.stages array; "
                "preserving any previously stored structure and matches."
            )
    return True
