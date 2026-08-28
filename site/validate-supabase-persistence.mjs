import fs from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(siteRoot, "..");
const apiRoot = resolve(siteRoot, "api");

const read = (path) => fs.readFile(path, "utf8");
const preferences = await read(resolve(apiRoot, "wallet-preferences.js"));
const walletOptIns = await read(resolve(apiRoot, "wallet-opt-ins.js"));
const walletPresence = await read(resolve(apiRoot, "_wallet-presence.js"));
const appCore = await read(resolve(siteRoot, "modules/app-core.js"));
const schema = await read(resolve(repoRoot, "supabase-schema.sql"));
const migration = await read(resolve(repoRoot, "supabase/migrations/20260823140000_minimize_wallet_preferences_table_state.sql"));
const documentation = await read(resolve(repoRoot, "SUPABASE_PERSISTENCE.md"));

function includes(source, expected, message) {
  if (!source.includes(expected)) {
    throw new Error(message);
  }
}

function excludes(source, unexpected, message) {
  if (source.includes(unexpected)) {
    throw new Error(message);
  }
}

for (const key of [
  "watchlistPlayerIds",
  "watchlists",
  "currentWatchlistId",
  "linkedWalletAddress",
  "recentSearchPlayerIds",
  "recentSearchAgentWallets",
]) {
  includes(
    preferences,
    `delete sanitized.${key};`,
    `wallet_preferences.table_state must not persist redundant ${key}.`,
  );
}

includes(
  preferences,
  "recentSearchItemsFromLegacy(source)",
  "Legacy player/agent recent searches must be folded into canonical recentSearchItems before redundant keys are stripped.",
);
includes(
  preferences,
  "function tableStateForClient(tableState)",
  "The wallet preferences API must retain a compatibility response for legacy recent-search clients.",
);
includes(
  preferences,
  "...legacyRecentSearchStateFromItems(canonical.recentSearchItems)",
  "Legacy recent-search arrays must be derived from canonical mixed history instead of stored independently.",
);
includes(
  preferences,
  "table_state: tableState || {},",
  "Supabase writes must use the canonical tableState rather than the compatibility response shape.",
);
excludes(
  preferences,
  "recentSearchPlayerIds: mergeRecentIds(incoming.recentSearchPlayerIds, current.recentSearchPlayerIds)",
  "Legacy player recent-search arrays must not regain independent cloud merge/storage ownership.",
);
excludes(
  preferences,
  "recentSearchAgentWallets: mergeRecentIds(incoming.recentSearchAgentWallets, current.recentSearchAgentWallets)",
  "Legacy agent recent-search arrays must not regain independent cloud merge/storage ownership.",
);

includes(
  walletPresence,
  'supabaseRequest("wallet_opt_ins?on_conflict=wallet_address"',
  "Wallet last-seen updates must have one canonical Supabase upsert owner.",
);
includes(walletPresence, "last_seen_at: now,", "The canonical wallet presence helper must update last_seen_at.");
includes(
  walletPresence,
  '"SELECT name FROM wallets WHERE lower(wallet_address) = lower(?) LIMIT 1"',
  "Wallet presence must resolve the current agent name from the runtime wallets table.",
);
includes(
  walletPresence,
  "if (agentName) presence.agent_name = agentName;",
  "Wallet presence must persist a non-empty runtime agent name without erasing an existing name on lookup misses.",
);
includes(
  walletOptIns,
  'const { touchWalletLastSeen } = require("./_wallet-presence");',
  "Wallet opt-in recording must reuse the canonical last-seen owner.",
);
includes(walletOptIns, "await touchWalletLastSeen(wallet)", "Opt-in must refresh the wallet last-seen timestamp.");
excludes(
  walletOptIns,
  'supabaseRequest("wallet_opt_ins',
  "wallet-opt-ins.js must not duplicate the wallet presence Supabase write.",
);

includes(
  preferences,
  'const { touchWalletLastSeen } = require("./_wallet-presence");',
  "Authenticated wallet preferences must reuse the canonical last-seen owner.",
);
includes(
  preferences,
  "async function readPreferencesForVisit(wallet)",
  "The wallet preferences GET path must own authenticated visit tracking.",
);
includes(
  preferences,
  "readPreferences(wallet),\n    touchWalletLastSeen(wallet).catch((error) => {",
  "Preferences and last-seen persistence must run in parallel so visit tracking does not add a serial startup round trip.",
);
includes(
  preferences,
  'console.warn("Could not update wallet last seen timestamp.", error);',
  "A last-seen write failure must remain non-blocking for required wallet preferences.",
);
includes(
  preferences,
  "response.status(200).json(await readPreferencesForVisit(wallet));",
  "Authenticated GET requests must refresh last_seen_at.",
);
includes(
  preferences,
  "const currentPreferences = await readPreferences(wallet);",
  "Preference PUT merging must use the non-visit read path and avoid redundant last-seen writes.",
);
includes(
  appCore,
  "const startupWalletPreferencesPromise = loadWalletPreferences();",
  "Application startup must continue loading authenticated wallet preferences so returning opted-in users refresh last_seen_at.",
);

includes(schema, "agent_name text", "The canonical Supabase schema must retain wallet agent-name storage.");
includes(schema, "last_seen_at timestamptz not null default now()", "The canonical Supabase schema must retain wallet last-seen storage.");
includes(schema, "- 'linkedWalletAddress'", "The canonical Supabase schema must clean redundant linked wallet identity from table_state.");
includes(
  schema,
  "jsonb_typeof(coalesce(table_state, '{}'::jsonb)->'recentSearchItems') = 'array'",
  "The canonical schema must only remove legacy recent-search arrays when canonical mixed history exists.",
);
includes(migration, "- 'linkedWalletAddress'", "The Issue #200 migration must remove duplicated linked wallet identity.");
includes(
  migration,
  "jsonb_typeof(coalesce(table_state, '{}'::jsonb)->'recentSearchItems') = 'array'",
  "The Issue #200 migration must preserve legacy-only search histories.",
);

for (const table of [
  "wallet_opt_ins",
  "wallet_permissions",
  "wallet_preferences",
  "evaluation_saves",
  "evaluation_shares",
  "mfl_season_ratios",
]) {
  includes(documentation, `\`${table}\``, `SUPABASE_PERSISTENCE.md must document ${table}.`);
}

includes(
  documentation,
  "current MFL agent name",
  "Supabase documentation must define wallet_opt_ins.agent_name as runtime MFL agent data.",
);
includes(
  documentation,
  "most recent authenticated visit/activity timestamp",
  "Supabase documentation must define last_seen_at as authenticated visit/activity data.",
);
includes(
  documentation,
  "Application startup already requests wallet preferences for a restored valid wallet proof",
  "Supabase documentation must explain how returning opted-in visits refresh wallet presence data.",
);

const apiFiles = await fs.readdir(apiRoot);
for (const filename of apiFiles.filter((name) => name.endsWith(".js") && name !== "_supabase.js")) {
  const source = await read(resolve(apiRoot, filename));
  if (!source.includes("supabaseRequest(") && !source.includes("supabaseConfig(")) {
    continue;
  }
  includes(
    documentation,
    `\`site/api/${filename}\``,
    `Every Supabase API owner must be documented; missing site/api/${filename}.`,
  );
}

includes(
  documentation,
  "`send_progression_emails.py`",
  "The server-side progression email Supabase reader must be documented.",
);
includes(
  documentation,
  "`.github/workflows/full-database-refresh.yml`",
  "The workflow that supplies Supabase credentials to progression email delivery must be documented.",
);

console.log("Supabase persistence ownership is documented, authenticated visits refresh wallet presence data, and wallet table_state stores only canonical cloud-owned data.");
