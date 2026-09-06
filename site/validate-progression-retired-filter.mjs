import { invariant } from "./validation/assertions.mjs";
import { readFile } from "node:fs/promises";

const pageSource = String(await readFile(new URL("./api/_data-page.js", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const rebuildSource = String(await readFile(new URL("../scripts/database/run_flow_rebuild_paged.py", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const runnerSource = String(await readFile(new URL("../scripts/database/rebuild_database_runner.py", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");

invariant(
  pageSource.includes('.map((column) => `coalesce(${quoteIdentifier(`${column}_${suffix}`)}, 0) > 0`)\n    .join(" OR ")})`;'),
  "Progression must require at least +1 in one stat in the selected current/all-time view for every player.",
);

invariant(
  !pageSource.includes('OR coalesce(retirement_years, -1) = 0'),
  "Retired players must not bypass the selected-view progression activity requirement.",
);

invariant(
  pageSource.includes('if (String(query.hideRetired || "") === "1") {\n    conditions.push("coalesce(retirement_years, -1) <> 0");\n  }'),
  "The Hide retired players filter must remove retired rows only when enabled.",
);

invariant(
  pageSource.includes('const order = orderSql(\n    scope,\n    view,\n    String(query.sortKey || (scope === "club" ? "positions" : "overall"))'),
  "Progression must retain overall as its default sort key.",
);

invariant(
  pageSource.includes('const derived = `${key}_${view === "current" ? "prog_current_season" : "prog_all"}`;\n    return `${quoteIdentifier(derived)} IS NULL, ${quoteIdentifier(derived)} ${direction}, ${quoteIdentifier(key)} ${direction}, player_id DESC`;'),
  "Current-season and all-time views must sort by the selected progression value first and the matching raw Overall/stat second.",
);

invariant(
  rebuildSource.includes('ACTIVE_PROGRESSION_BATCHES = prepare_progression_batches(\n        active_players,\n        "CURRENT_SEASON",\n    )')
    && rebuildSource.includes('RETIRED_PROGRESSION_BATCHES = prepare_progression_batches(\n        retired_players,\n        "ALL",\n    )'),
  "Database rebuild must prepare active current-season batches and retired ALL-only batches separately.",
);

invariant(
  rebuildSource.includes('PREVIOUS_DATABASE_PATH = Path("previous-database/mfl_database.db")')
    && rebuildSource.includes('restore_retired_all_progression(connection)')
    && rebuildSource.includes('missing_retired_ids = missing_retired_all_player_ids(connection)'),
  "Retired ALL progression must reuse the previous database before deciding which players need an API request.",
);

invariant(
  rebuildSource.includes('AND ({missing_values})')
    && rebuildSource.includes('retired_all_batches = [\n        [player_id for player_id in batch if player_id in missing_retired_ids]'),
  "Retired ALL requests must be restricted to rows whose all-time progression values are still unset.",
);

invariant(
  rebuildSource.includes('("CURRENT_SEASON", "current_season", batch)\n        for batch in active_batches')
    && !rebuildSource.includes('("CURRENT_SEASON", "current_season", batch)\n        for batch in retired_all_batches'),
  "Retired players must never be requested with CURRENT_SEASON progression.",
);

invariant(
  rebuildSource.includes('def progression_url(player_ids: list[int], interval: str) -> str:')
    && rebuildSource.includes('def prepare_progression_batches(\n    players: list[dict[str, Any]],\n    interval: str,')
    && rebuildSource.includes('candidate_url_length = len(progression_url(candidate, interval))'),
  "Canonical paged progression batching must honor the requested interval for active and retired batches.",
);
invariant(
  !runnerSource.includes('def progression_url(')
    && !runnerSource.includes('def prepare_progression_batches(')
    && !runnerSource.includes('paged.prepare_progression_batches ='),
  "Production runner must consume the canonical paged progression planner instead of replacing it.",
);

console.log("Progression retired-player ALL cache, activity, sorting, and canonical batch ownership validation passed.");
