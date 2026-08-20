import { readFile } from "node:fs/promises";

const pageSource = String(await readFile(new URL("./api/_data-page.js", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const rebuildSource = String(await readFile(new URL("../run_flow_rebuild_paged.py", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

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
  pageSource.includes('const derived = `${key}_${view === "current" ? "prog_current_season" : "prog_all"}`;\n    return `${quoteIdentifier(derived)} IS NULL, ${quoteIdentifier(derived)} ${direction}, overall ${direction}, player_id DESC`;'),
  "Current-season and all-time views must sort the default overall key by overall progression.",
);

invariant(
  rebuildSource.includes('retired_players = results.get("retired")')
    && rebuildSource.includes('PROGRESSION_BATCHES = prepare_progression_batches([*active_players, *retired_players])'),
  "Database rebuild progression batches must include both active and retired player sources.",
);

invariant(
  rebuildSource.includes('from {len(eligible_ids)} active/retired players;')
    && !rebuildSource.includes('and all retired players'),
  "Database rebuild must no longer exclude retired players from progression requests.",
);

console.log("Progression retired-player data, activity, and sorting validation passed.");
