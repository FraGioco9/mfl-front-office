import { readWorkflowSource } from "./validation/workflow-source.mjs";
import { readFile, readdir } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => { if (!condition) throw new Error(message); };

async function readNamedSources(directory, predicate) {
  const names = (await readdir(new URL(directory, import.meta.url))).filter(predicate).sort();
  return Promise.all(names.map(async (name) => [name, await read(`${directory}${name}`)]));
}

function unscopedPreferenceSaveOwners(sources) {
  const owners = [];
  for (const [sourceName, source] of sources) {
    const expression = /(?:await\s+|void\s+)?saveWalletPreferencesNow\(\);/g;
    for (const match of source.matchAll(expression)) {
      const before = source.slice(0, match.index);
      const functionMatches = [...before.matchAll(/(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/g)];
      const functionName = functionMatches.at(-1)?.[1] || "unknown";
      owners.push(`${sourceName}:${functionName}`);
    }
  }
  return owners;
}

const [canonicalSources, generatedSources, walletPreferencesApi, vercelSiteUpdate, fullDatabaseRefresh] = await Promise.all([
  readNamedSources("./modules/core-sources/", (name) => name.endsWith(".js")),
  readNamedSources("./modules/", (name) => /^app-core(?:-[a-z0-9-]+)?-runtime\.js$/.test(name)),
  read("./api/wallet-preferences.js"),
  read("../.github/workflows/vercel-site-update.yml"),
  readWorkflowSource(new URL("../.github/workflows/full-database-refresh.yml", import.meta.url)),
]);

const applicationSources = [...canonicalSources, ...generatedSources];
const combinedApplicationSource = applicationSources.map(([, source]) => source).join("\n");
const unscopedSaveOwners = unscopedPreferenceSaveOwners(applicationSources);

invariant(
  unscopedSaveOwners.length === 0,
  `Application code must never perform an unscoped wallet-preference save. Remaining owners: ${unscopedSaveOwners.join(", ")}`,
);
invariant(
  combinedApplicationSource.includes('saveWalletPreferencesNow({ domains: ["playerNotes"] });'),
  "Player Note autosaves must persist only the playerNotes domain.",
);
invariant(
  combinedApplicationSource.includes('saveWalletPreferencesNow({ domains: ["watchlists"] });'),
  "Empty-cloud Watchlist recovery must persist only the watchlists domain.",
);
invariant(
  combinedApplicationSource.includes('saveWalletPreferencesNow({ domains: ["watchlists", "tableState", "settings"] });'),
  "Intentional Watchlist mutations must persist Watchlists, their table state, and pending notification-target cleanup only.",
);
invariant(
  (combinedApplicationSource.match(/saveWalletPreferencesNow\(\{ domains: \["tableState"\] \}\);/g) || []).length >= 4,
  "Canonical and generated table-state/Evaluation saves must all be explicitly scoped to tableState.",
);
invariant(
  combinedApplicationSource.includes('saveWalletPreferencesNow({ domains: ["settings"] });')
    && combinedApplicationSource.includes('saveWalletPreferencesNow({ domains: ["settings"], includeSettings: true })'),
  "Direct Settings changes and theme sync must both remain explicitly scoped to Settings.",
);

invariant(
  walletPreferencesApi.includes('const hasDomain = (key) => Object.prototype.hasOwnProperty.call(incoming, key);')
    && walletPreferencesApi.includes('if (hasDomain("watchlists")) patch.watchlists = normalizeWatchlists(incoming.watchlists);')
    && walletPreferencesApi.includes('method: "PATCH"'),
  "The wallet-preferences API must continue patching only request-supplied domains.",
);

for (const [name, workflow] of [
  ["Vercel Site Update", vercelSiteUpdate],
  ["Full Database Refresh", fullDatabaseRefresh],
]) {
  const normalized = workflow.toLowerCase();
  invariant(
    !normalized.includes("wallet_preferences")
      && !normalized.includes("wallet-preferences")
      && !/truncate\s+(?:table\s+)?(?:public\.)?wallet_preferences/.test(normalized)
      && !/delete\s+from\s+(?:public\.)?wallet_preferences/.test(normalized),
    `${name} must not directly mutate or reset persisted wallet preferences/Watchlists.`,
  );
}

console.log("Wallet preference writes are domain-scoped and deployment/refresh workflows cannot reset Supabase Watchlists.");
