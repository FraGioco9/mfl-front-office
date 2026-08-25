import { readFile } from "node:fs/promises";

const apiSource = String(await readFile(new URL("./api/data.js", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const coreSource = String(await readFile(new URL("./modules/app-core.js", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

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
  apiSource.includes('else if (mode === "page") data = await pagedData(pageRequest, signedWallet, fullAccess, ownedProgression);'),
  "Paged player data must use the progression-capable player request.",
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

console.log("Public entity progression access validation passed.");
