import { invariant } from "./validation/assertions.mjs";
import { readFile } from "node:fs/promises";
import { readCombinedCanonicalCoreSource } from "./validate-core-sources.mjs";

const apiSource = String(await readFile(new URL("./api/data.js", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const coreSource = readCombinedCanonicalCoreSource().replace(/\r\n?/g, "\n");

invariant(
  apiSource.includes('const playerEntityProgression = scope === "player";'),
  "Player entity requests must have an explicit public progression access path.",
);

invariant(
  apiSource.includes('const publicEntityProgression = playerEntityProgression\n      || (["agent", "club"].includes(scope) && ["current", "all"].includes(view));'),
  "Player progression must be public independently of the player route view while Agent and Club progression retain their current/all contract.",
);

invariant(
  apiSource.includes('const pageRequest = mode === "page" && playerEntityProgression\n      ? { ...request, query: { ...query, includeProgression: "1" } }\n      : request;'),
  "Player page requests must include progression columns even though the canonical player route loads as Attributes.",
);

invariant(
  apiSource.includes('else if (mode === "page") data = await pagedData(pageRequest, signedWallet, fullAccess, ownedProgression, timings);'),
  "Paged player data must use the progression-capable player request while sharing the canonical timing collector.",
);

invariant(
  apiSource.includes('const publicWatchlistProgression = scope === "watchlist"\n      && ["current", "all"].includes(view);'),
  "Watchlist current/all views must receive progression columns without full Progression permission.",
);

invariant(
  apiSource.includes('const fullAccess = publicEntityProgression || publicWatchlistProgression || (\n      accessMode === "full-progression"'),
  "Public entity and Watchlist progression must bypass only the full-progression permission check, not replace the canonical access flow.",
);

invariant(
  !apiSource.includes('scope === "progression"\n      && ["current", "all"].includes(view)'),
  "The main Progression scope must remain excluded from public progression access.",
);

invariant(
  coreSource.includes('if (["current", "all"].includes(route.view)) query.set("includeProgression", "1");'),
  "Current-season and all-time entity requests must continue asking the API for progression columns.",
);

invariant(
  coreSource.includes('function playerCanViewProgression(row = null) {\n  return true;\n}'),
  "Player Current Season and All Time views must remain visible without progression permission.",
);

invariant(
  coreSource.includes('if (pageName === "progression") {\n    return hasProgressionAccess() ? "full" : "public";\n  }'),
  "The main Progression page must retain its full-access permission gate.",
);

invariant(
  coreSource.includes('const tablePages = new Set(["database", "mfl", "agents", "progression", "watchlist", "myplayers", "club"]);'),
  "Club must be a canonical table page without post-start mutation.",
);
invariant(
  coreSource.includes('club: ["attributes", "contracts", "current", "all"],'),
  "Club public progression views must live in the canonical page-view table without the retired Info view.",
);
invariant(
  coreSource.includes('club: "attributes",'),
  "Club must use Squad/Attributes as its canonical default view.",
);
for (const retired of [
  "PUBLIC_PROGRESSION_VIEWS",
  "PUBLIC_TABLE_PAGES",
  "allowedViewsForPublicTables",
  "normalizePublicProgressionView",
  "currentPublicProgressionDataAccess",
  'tablePages.add("club")',
]) {
  invariant(!coreSource.includes(retired), `Legacy public-progression compatibility owner must stay removed: ${retired}`);
}

console.log("Public entity progression access validation passed.");
