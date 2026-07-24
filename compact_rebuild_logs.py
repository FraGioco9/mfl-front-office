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


def compact_message(message: str) -> str:
    total_time = re.fullmatch(r"Total time: (\d+)s", message)
    if total_time:
        seconds = int(total_time.group(1))
        minutes, remaining_seconds = divmod(seconds, 60)
        return f"Total time: {minutes}m {remaining_seconds}s"

    patterns: tuple[tuple[str, str], ...] = (
        (
            r"^Leaderboard import complete: loaded (\d+) wallet addresses and names$",
            r"Leaderboard: \1 wallets",
        ),
        (
            r"^Flow metadata settings: player IDs (\d+) and above, fixed batches of (\d+) IDs, up to (\d+) parallel requests$",
            r"Metadata: IDs \1+, batch \2, workers \3",
        ),
        (
            r"^Flow ownership settings: .*fixed batches of (\d+) wallets with up to (\d+) parallel requests; MFL wallet membership in fixed batches of (\d+) player IDs with up to \2 parallel requests$",
            r"Ownership: wallet batch \1, MFL batch \3, workers \2",
        ),
        (
            r"^Flow metadata pull: (\d+) batches with up to (\d+) parallel requests$",
            r"Metadata: \1 batches, \2 workers",
        ),
        (
            r"^Flow metadata batch \d+/(\d+) complete \((\d+)/\1 finished\): IDs (\d+)-(\d+), requested \d+, returned (\d+), total (\d+)$",
            r"Metadata \2/\1: IDs \3-\4, +\5, total \6",
        ),
        (
            r"^Flow ownership snapshot: (\d+) wallets in (\d+) batches at block (\d+), up to (\d+) parallel requests$",
            r"Ownership: \1 wallets, \2 batches, block \3, \4 workers",
        ),
        (
            r"^Flow ownership wallet batch \d+/(\d+) complete \((\d+)/\1 finished\): wallets \d+, non-empty \d+, player IDs (\d+), total IDs (\d+)$",
            r"Ownership \2/\1: +\3, total \4",
        ),
        (
            r"^Flow MFL wallet membership: checking (\d+) unresolved player IDs in (\d+) batches at block (\d+), up to (\d+) parallel requests$",
            r"MFL check: \1 IDs, \2 batches, block \3, \4 workers",
        ),
        (
            r"^Flow MFL wallet membership batch \d+/(\d+) complete \((\d+)/\1 finished\): checked \d+, owned (\d+), total owned (\d+)$",
            r"MFL check \2/\1: +\3, total \4",
        ),
        (
            r"^Progression (ALL|CURRENT_SEASON) batch (\d+)/(\d+): updated (\d+) players$",
            r"Progression \1 \2/\3: +\4",
        ),
        (
            r"^Flow wallet ownership snapshot complete: resolved (\d+) player owners$",
            r"Ownership complete: \1 players",
        ),
        (
            r"^Progression refresh complete: (\d+) interval rows updated$",
            r"Progression complete: \1 players",
        ),
        (
            r"^Next Overall refresh complete: (\d+) players updated$",
            r"Next Overall calculated for \1 players",
        ),
        (
            r"^Flow database rebuild complete: (.+)$",
            r"Rebuild complete: \1",
        ),
        (
            r"^Flow player batch \d+-\d+ failed; retrying in (\d+)s \((\d+)/(\d+)\)$",
            r"Metadata retry \2/\3 in \1s",
        ),
        (
            r"^Flow wallet collections .* failed; retrying in (\d+)s \((\d+)/(\d+)\)$",
            r"Ownership retry \2/\3 in \1s",
        ),
        (
            r"^Flow MFL wallet membership IDs .* failed; retrying in (\d+)s \((\d+)/(\d+)\)$",
            r"MFL retry \2/\3 in \1s",
        ),
        (
            r"^Progression (ALL|CURRENT_SEASON) request failed; retrying in (\d+)s \((\d+)/(\d+)\)$",
            r"Progression \1 retry \3/\4 in \2s",
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

    builtins.print(compact_message(args[0]), *args[1:], **kwargs)


def install_compact_rebuild_logs(entry_module: ModuleType | None = None) -> None:
    modules = [sys.modules.get(name) for name in _MODULE_NAMES]
    if entry_module is not None:
        modules.append(entry_module)

    for module in modules:
        if module is not None:
            module.print = compact_print
