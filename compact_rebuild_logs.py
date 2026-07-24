from __future__ import annotations

import builtins
import re
import sys
from types import ModuleType
from typing import Any

_MODULE_NAMES = (
    "flow_data",
    "flow_wallet_ownership",
    "flow_mfl_wallet_membership",
    "flow_owned_since",
    "leaderboard_rebuild",
    "mfl_wallet_config",
    "progression_rebuild",
    "rebuild_database",
)

_SUPPRESSED_PATTERNS = (
    r"^Flow metadata batch ",
    r"^Flow ownership wallet batch ",
    r"^Flow MFL wallet membership batch ",
    r"^Progression (ALL|CURRENT_SEASON) batch ",
)


def compact_message(message: str) -> str:
    total_time = re.fullmatch(r"Total time: (\d+)s", message)
    if total_time:
        seconds = int(total_time.group(1))
        minutes, remaining_seconds = divmod(seconds, 60)
        return f"Total time: {minutes}m {remaining_seconds}s"

    patterns: tuple[tuple[str, str], ...] = (
        (
            r"^Flow metadata pull: (\d+) batches with up to (\d+) parallel requests$",
            r"Pulling player seasons",
        ),
        (
            r"^Flow wallet ownership snapshot complete: resolved (\d+) player owners$",
            r"Player ownership pulled: \1 players",
        ),
        (
            r"^Progression refresh complete: (\d+) interval rows updated$",
            r"Player progression pulled: \1 players",
        ),
        (
            r"^Next Overall refresh complete: (\d+) players updated$",
            r"Next Overall calculated: \1 players",
        ),
        (
            r"^Flow database rebuild complete: (.+)$",
            r"Rebuild complete: \1",
        ),
        (
            r"^Flow player batch \d+-\d+ failed; retrying in (\d+)s \((\d+)/(\d+)\)$",
            r"Player season retry \2/\3 in \1s",
        ),
        (
            r"^Progression (ALL|CURRENT_SEASON) request failed; retrying in (\d+)s \((\d+)/(\d+)\)$",
            r"Player progression \1 retry \3/\4 in \2s",
        ),
    )

    for pattern, replacement in patterns:
        compacted, count = re.subn(pattern, replacement, message)
        if count:
            return compacted
    return message


def compact_print(*args: Any, **kwargs: Any) -> None:
    output = kwargs.get("file")
    if output not in {None, sys.stdout} or not args or not isinstance(args[0], str):
        builtins.print(*args, **kwargs)
        return

    message = args[0]
    if any(re.match(pattern, message) for pattern in _SUPPRESSED_PATTERNS):
        return

    builtins.print(compact_message(message), *args[1:], **kwargs)


def install_compact_rebuild_logs(entry_module: ModuleType | None = None) -> None:
    modules = [sys.modules.get(name) for name in _MODULE_NAMES]
    if entry_module is not None:
        modules.append(entry_module)

    for module in modules:
        if module is not None:
            module.print = compact_print
