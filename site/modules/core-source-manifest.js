// Canonical lexical fragments preserve domain execution order, assemble into one browser runtime per domain, and remain invisible to browser request topology.
// Validators spanning a fragmented domain must consume the manifest-assembled canonical source rather than one physical fragment.
// This contract applies equally to universal Shared code and lazily loaded route domains such as Table.
const entries = [
  ["shared", ["shared-foundations.js", "shared-session.js", "shared-routing.js", "shared-transitions.js", "shared-page-lifecycle.js", "shared-home-summary.js", "shared-table-state.js", "shared-toast-core.js", "shared-personal-state.js", "shared-data-search.js", "shared-evaluation-lifecycle.js", "shared-player-first-paint.js", "shared-watchlist-actions.js", "shared-player-display.js", "shared-player-actions.js", "shared-modal-lifecycle.js", "shared-global-search.js", "shared-wallet-row-classification.js", "shared-html-escaping.js", "shared-incremental-routing.js", "shared-interaction-bindings.js", "shared-startup-lifecycle.js", "shared-layout-center.js", "shared-incremental-navigation.js", "shared-route-runtime-gate.js", "shared-core-contracts.js", "shared-app-startup.js", "shared-shell-navigation.js"], "app-core-runtime.js", "// Generated Shared core by build-app-core.mjs from the canonical source manifest. Do not edit directly.\n", 355000],
  ["evaluation", "evaluation.js", "app-core-evaluation-runtime.js", "// Generated Evaluation core from modules/core-sources/evaluation.js. Do not edit directly.\n"],
  ["mflstats", "mfl-stats.js", "app-core-mfl-stats-runtime.js", "// Generated MFL Stats core from modules/core-sources/mfl-stats.js. Do not edit directly.\n"],
  ["club", "club.js", "app-core-club-runtime.js", "// Generated Club core from modules/core-sources/club.js. Do not edit directly.\n"],
  ["my-clubs", "my-clubs.js", "app-core-my-clubs-runtime.js", "// Generated My Clubs core from modules/core-sources/my-clubs.js. Do not edit directly.\n"],
  ["settings", "settings.js", "app-core-settings-runtime.js", "// Generated Settings core from modules/core-sources/settings.js. Do not edit directly.\n"],
  ["player", "player.js", "app-core-player-runtime.js", "// Generated Player core from modules/core-sources/player.js. Do not edit directly.\n"],
  ["table", ["table.js", "table-render-lifecycle.js", "table-interaction-bindings.js"], "app-core-table-runtime.js", "// Generated Table core from modules/core-sources/table.js. Do not edit directly.\n"],
  ["wallet", "wallet.js", "app-core-wallet-runtime.js", "// Generated Wallet core from modules/core-sources/wallet.js. Do not edit directly.\n"],
  ["watchlist", "watchlist.js", "app-core-watchlist-runtime.js", "// Generated Watchlist core from modules/core-sources/watchlist.js. Do not edit directly.\n"],
];

export const coreSourceManifest = Object.freeze(entries.map(([domain, source, runtime, banner, maxUniversalBytes = null]) => {
  const sources = Array.isArray(source) ? source : [source];
  return Object.freeze({
    domain,
    source: sources[0],
    sources: Object.freeze([...sources]),
    runtime,
    banner,
    maxUniversalBytes,
  });
}));

export const coreSourceByDomain = Object.freeze(Object.fromEntries(coreSourceManifest.map((entry) => [entry.domain, entry])));
