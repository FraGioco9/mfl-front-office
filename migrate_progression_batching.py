from __future__ import annotations

from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one {label} fragment, found {count}")
    return source.replace(old, new, 1)


def replace_section(source: str, start_marker: str, end_marker: str, replacement: str, label: str) -> str:
    start = source.find(start_marker)
    if start < 0:
        raise RuntimeError(f"Could not find {label} start")
    end = source.find(end_marker, start)
    if end < 0:
        raise RuntimeError(f"Could not find {label} end")
    if source.find(start_marker, start + len(start_marker)) >= 0:
        raise RuntimeError(f"Found duplicate {label} start")
    return source[:start] + replacement + source[end:]


def write_if_changed(path: Path, original: str, updated: str) -> None:
    if original == updated:
        print(f"Unchanged {path}")
        return
    path.write_text(updated, encoding="utf-8")
    print(f"Migrated {path}")


paged_path = Path("run_flow_rebuild_paged.py")
runner_path = Path("rebuild_database_runner.py")

paged_original = paged_path.read_text(encoding="utf-8").replace("\r\n", "\n")
runner_original = runner_path.read_text(encoding="utf-8").replace("\r\n", "\n")

paged = paged_original
runner = runner_original

paged = replace_once(
    paged,
    "FIRST_PLAYER_ID = 42\nPREVIOUS_DATABASE_PATH = Path(\"previous-database/mfl_database.db\")\n",
    "FIRST_PLAYER_ID = 42\nPROGRESSION_MAX_URL_LENGTH = 5000\nPREVIOUS_DATABASE_PATH = Path(\"previous-database/mfl_database.db\")\n",
    "canonical progression URL limit",
)

new_planner = '''def progression_url(player_ids: list[int], interval: str) -> str:\n    """Return the canonical progression request URL for a planned player batch."""\n    query = pipeline.urlencode(\n        {\n            "playersIds": ",".join(str(player_id) for player_id in player_ids),\n            "interval": interval,\n        }\n    )\n    return f"{pipeline.PROGRESSIONS_URL}?{query}"\n\n\ndef prepare_progression_batches(\n    players: list[dict[str, Any]],\n    interval: str,\n) -> tuple[tuple[int, ...], ...]:\n    """Build canonical progression batches bounded by player count and URL length."""\n    excluded_wallets = {\n        pipeline.MFL_WALLET_ADDRESS.lower(),\n        pipeline.MFL_TRADE_WALLET_ADDRESS.lower(),\n    }\n    unique_players = {\n        pipeline.player_id(player): player\n        for player in players\n    }\n    eligible_ids = sorted(\n        player_id\n        for player_id, player in unique_players.items()\n        if _owner_wallet_address(player) not in excluded_wallets\n    )\n\n    batches: list[tuple[int, ...]] = []\n    current: list[int] = []\n    for player_id in eligible_ids:\n        candidate = [*current, player_id]\n        candidate_url_length = len(progression_url(candidate, interval))\n        if current and (\n            len(candidate) > pipeline.PROGRESSION_BATCH_SIZE\n            or candidate_url_length > PROGRESSION_MAX_URL_LENGTH\n        ):\n            batches.append(tuple(current))\n            current = [player_id]\n        else:\n            current = candidate\n\n        current_url_length = len(progression_url(current, interval))\n        if current_url_length > PROGRESSION_MAX_URL_LENGTH:\n            raise RuntimeError(\n                f"Progression {interval} URL exceeds {PROGRESSION_MAX_URL_LENGTH} characters "\n                f"for player {player_id}"\n            )\n\n    if current:\n        batches.append(tuple(current))\n\n    excluded_count = len(unique_players) - len(eligible_ids)\n    longest_url = max(\n        (len(progression_url(list(batch), interval)) for batch in batches),\n        default=0,\n    )\n    pipeline.log(\n        f"Progression {interval} batches ready: {len(batches)} batches from "\n        f"{len(eligible_ids)} players; longest URL {longest_url}/"\n        f"{PROGRESSION_MAX_URL_LENGTH} characters; excluded {excluded_count} "\n        "MFL/MFL Trade players"\n    )\n    return tuple(batches)\n\n\n'''
paged = replace_section(
    paged,
    "def prepare_progression_batches(\n",
    "def fetch_player_sources_and_prepare_progressions(\n",
    new_planner,
    "paged progression planner",
)

runner = replace_once(
    runner,
    "PROGRESSION_MAX_URL_LENGTH = 5000\n",
    "",
    "runner progression URL limit",
)
runner = replace_section(
    runner,
    "def progression_url(player_ids: list[int], interval: str) -> str:\n",
    "def configure_rebuild() -> None:\n",
    "",
    "runner duplicate progression planner",
)
runner = replace_once(
    runner,
    "    paged.prepare_progression_batches = prepare_progression_batches\n",
    "",
    "runner progression planner monkey patch",
)

for required in [
    "PROGRESSION_MAX_URL_LENGTH = 5000",
    "def progression_url(player_ids: list[int], interval: str) -> str:",
    "def prepare_progression_batches(",
    "candidate_url_length > PROGRESSION_MAX_URL_LENGTH",
    "len(candidate) > pipeline.PROGRESSION_BATCH_SIZE",
]:
    if required not in paged:
        raise RuntimeError(f"Canonical paged progression planner is missing: {required}")

for retired in [
    "def progression_url(player_ids: list[int], interval: str) -> str:",
    "def prepare_progression_batches(",
    "paged.prepare_progression_batches =",
    "PROGRESSION_MAX_URL_LENGTH =",
]:
    if retired in runner:
        raise RuntimeError(f"Runner still owns progression batching through: {retired}")

write_if_changed(paged_path, paged_original, paged)
write_if_changed(runner_path, runner_original, runner)
