import { readFile } from "node:fs/promises";

const apiSource = String(await readFile(new URL("./api/data.js", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const coreSource = String(await readFile(new URL("./modules/app-core.js", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

invariant(
  apiSource.includes('const publicEntityProgression = ["agent", "club"].includes(scope)\n      && ["current", "all"].includes(view);'),
  "Agent and Club progression must retain their canonical public entity access contract.",
);

invariant(
  apiSource.includes('const publicWatchlistProgression = scope === "watchlist"\n      && ["current", "all"].includes(view);'),
  "Watchlist current/all views must receive progression columns without full Progression permission.",
);

invariant(
  apiSource.includes('const fullAccess = publicEntityProgression || publicWatchlistProgression || (\n      accessMode === "full-progression"'),
  "Public Watchlist progression must bypass only the full-progression permission check, not replace the canonical access flow.",
);

invariant(
  !apiSource.includes('scope === "progression"\n      && ["current", "all"].includes(view)'),
  "The main Progression scope must remain excluded from public progression access.",
);

invariant(
  coreSource.includes('if (["current", "all"].includes(route.view)) query.set("includeProgression", "1");'),
  "Current-season and all-time Watchlist requests must continue asking the API for progression columns.",
);

invariant(
  coreSource.includes('if (pageName === "progression") {\n    return hasProgressionAccess() ? "full" : "public";\n  }'),
  "The main Progression page must retain its full-access permission gate.",
);

console.log("Watchlist public progression access validation passed.");
