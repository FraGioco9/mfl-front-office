from __future__ import annotations

import json
import os
from typing import Any
from urllib.request import Request, urlopen

from scripts.database import competition_storage

BASE_URL = "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod"
TOKEN_HEADER = "X-MFL-Api-Token"


def request_json(url: str) -> Any:
    token = os.environ.get("MFL_API_TOKEN", "").strip()
    if not token:
        raise RuntimeError("MFL_API_TOKEN is unavailable")
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "mfl-front-office-schema-probe/1.0",
            TOKEN_HEADER: token,
        },
    )
    with urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def type_name(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, dict):
        return "object"
    if isinstance(value, list):
        return "array"
    if isinstance(value, (int, float)):
        return "number"
    return "string"


def shape(mapping: Any) -> dict[str, str]:
    if not isinstance(mapping, dict):
        return {}
    return {key: type_name(value) for key, value in sorted(mapping.items())}


def compact_side_shape(match: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in sorted(match.items()):
        lowered = key.lower()
        if not any(part in lowered for part in ("home", "away", "club", "squad", "team", "participant")):
            continue
        if isinstance(value, dict):
            result[key] = {"type": "object", "keys": sorted(value)}
        elif isinstance(value, list):
            result[key] = {
                "type": "array",
                "length": len(value),
                "itemType": type_name(value[0]) if value else "empty",
                "itemKeys": sorted(value[0]) if value and isinstance(value[0], dict) else [],
            }
        else:
            result[key] = {"type": type_name(value), "value": value}
    return result


def first_mapping(items: Any) -> dict[str, Any]:
    if not isinstance(items, list):
        return {}
    return next((item for item in items if isinstance(item, dict)), {})


def main() -> None:
    index = request_json(f"{BASE_URL}/competitions?upcoming=true")
    candidates = index if isinstance(index, list) else index.get("competitions", []) if isinstance(index, dict) else []
    live = next(
        item
        for item in candidates
        if isinstance(item, dict)
        and str(item.get("status", "")).upper() == "LIVE"
        and item.get("id") is not None
    )
    competition_id = int(live["id"])
    detail = request_json(f"{BASE_URL}/competitions/{competition_id}")
    if not isinstance(detail, dict):
        raise RuntimeError("Competition detail was not an object")

    schedule = detail.get("schedule") if isinstance(detail.get("schedule"), dict) else {}
    stage = first_mapping(schedule.get("stages"))
    group = first_mapping(stage.get("groups"))
    rounds_owner = group if group else stage
    round_data = first_mapping(rounds_owner.get("rounds"))
    match = first_mapping(round_data.get("matches"))
    if not match:
        raise RuntimeError("Live competition probe found no match")

    home_club_id = competition_storage._match_club_id(match, "home")
    away_club_id = competition_storage._match_club_id(match, "away")
    if home_club_id is None or away_club_id is None:
        raise RuntimeError(
            "Competition normalizer still cannot resolve live home/away club IDs"
        )

    reward = first_mapping(detail.get("rewards"))
    if reward:
        _, _, reward_label, _ = competition_storage._reward_fields(reward)
        if "lines" in reward and not reward_label:
            raise RuntimeError("Competition normalizer still cannot resolve live reward lines")

    print("COMPETITION_SCHEMA_PROBE_BEGIN")
    print("competitionId", competition_id)
    print("detail", json.dumps(shape(detail), sort_keys=True))
    print("schedule", json.dumps(shape(schedule), sort_keys=True))
    print("stage", json.dumps(shape(stage), sort_keys=True))
    print("group", json.dumps(shape(group), sort_keys=True))
    print("round", json.dumps(shape(round_data), sort_keys=True))
    print("match", json.dumps(shape(match), sort_keys=True))
    print("matchSides", json.dumps(compact_side_shape(match), sort_keys=True))
    print("normalizedMatchClubIds", home_club_id, away_club_id)
    print("reward", json.dumps(shape(reward), sort_keys=True))
    for key in ("standings", "ranking", "rankings", "table", "participants"):
        if key in group:
            value = group[key]
            first = first_mapping(value)
            print(f"group.{key}", json.dumps({"type": type_name(value), "itemShape": shape(first)}, sort_keys=True))
        if key in stage:
            value = stage[key]
            first = first_mapping(value)
            print(f"stage.{key}", json.dumps({"type": type_name(value), "itemShape": shape(first)}, sort_keys=True))
    print("COMPETITION_SCHEMA_PROBE_END")


if __name__ == "__main__":
    main()
