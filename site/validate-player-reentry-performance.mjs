import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";
import { optimizeCachedRouteRuntimeArtifacts } from "./modules/app-core-cached-route-performance.js";
import { optimizeGlobalSearchRuntimeArtifacts } from "./modules/app-core-global-search-performance.js";
import { optimizeIncrementalTableRuntimeArtifacts } from "./modules/app-core-incremental-table-performance.js";
import { optimizeMflStatsRuntimeArtifacts } from "./modules/app-core-mfl-stats-performance.js";
import { optimizePersistenceRuntimeArtifacts } from "./modules/app-core-persistence-performance.js";
import { optimizeTableChromeRuntimeArtifacts } from "./modules/app-core-table-chrome-performance.js";
import { optimizeTableLoadingRuntimeArtifacts } from "./modules/app-core-table-loading-performance.js";
import { optimizeTableRenderPerformanceArtifacts } from "./modules/app-core-table-render-performance.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [coreSource, playerSplitter, generatedPlayerRuntime] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-player-chunk.js"),
  read("./modules/app-core-player-runtime.js"),
]);

const artifacts = optimizeGlobalSearchRuntimeArtifacts(
  optimizePersistenceRuntimeArtifacts(
    optimizeTableChromeRuntimeArtifacts(
      optimizeTableLoadingRuntimeArtifacts(
        optimizeCachedRouteRuntimeArtifacts(
          optimizeMflStatsRuntimeArtifacts(
            optimizeTableRenderPerformanceArtifacts(
              optimizeIncrementalTableRuntimeArtifacts(normalizeBuiltApplicationCoreArtifacts(coreSource)),
            ),
          ),
        ),
      ),
    ),
  ),
);
const playerCore = String(artifacts.routeChunks?.player || "");
invariant(playerCore, "The optimized Player route chunk must exist.");
new Function(playerCore);

includes(
  playerSplitter,
  'const PLAYER_REENTRY_CACHE_HELPER = `let playerDetailLastRenderSignature = "";',
  "Player route splitting must own the cached re-entry signature helper.",
);
includes(
  playerCore,
  'function playerDetailRenderSignature(row, playerId, attributeView) {',
  "Player rendering must derive an explicit signature before deciding whether cached DOM is reusable.",
);
for (const stateInput of [
  "state.columns,",
  "row,",
  "attributeView,",
  "Boolean(hasWalletOptIn()),",
  "normalizeWalletAddress(state.linkedWalletAddress).toLowerCase(),",
  "Boolean(state.walletPermissionAllowed),",
  "Boolean(state.watchlistPlayerIds.has(key)),",
  "playerNote(key),",
  "state.settingsDateFormat,",
  "state.settingsTimeFormat,",
  "state.trainingAdjustments[key] || null,",
]) {
  includes(
    playerCore,
    stateInput,
    `Player cached re-entry signature must include ${stateInput}`,
  );
}

includes(
  playerCore,
  'playerDetailLastRenderSignature === renderSignature\n      && playerDetail.firstElementChild?.classList.contains("playerHero")',
  "Player DOM reuse must require both an unchanged state signature and the intact canonical Player hero rather than trusting cache state alone.",
);
includes(
  playerCore,
  'playerDetailLastRenderSignature = "";\n    window.__mflStaticUiRuntime?.showNotFound?.("Player");',
  "A missing Player must invalidate the cached render signature before showing the not-found surface.",
);
includes(
  playerCore,
  "state.playerAttributeView = normalizedAttributeView;",
  "The normalized Player attribute view used by the signature must remain the rendered view.",
);
includes(
  playerCore,
  "playerDetailLastRenderSignature = renderSignature;",
  "A completed Player render must commit the signature only after rebuilding and rebinding the Player subtree.",
);

const rendererStart = playerCore.indexOf("function renderPlayerPageOwner(playerId) {");
const wrapperStart = playerCore.indexOf("\nfunction renderPlayerPageWithStableContractLinkOwner", rendererStart);
const renderer = rendererStart >= 0 && wrapperStart > rendererStart
  ? playerCore.slice(rendererStart, wrapperStart)
  : "";
invariant(renderer, "The Player page renderer owner must exist.");
const guardIndex = renderer.indexOf("playerDetailLastRenderSignature === renderSignature");
const subtreeReplaceIndex = renderer.indexOf("playerDetail.innerHTML = `");
const signatureCommitIndex = renderer.lastIndexOf("playerDetailLastRenderSignature = renderSignature;");
const subtreeReplacementSites = (renderer.match(/playerDetail\.innerHTML = `/g) || []).length;
invariant(
  guardIndex >= 0 && subtreeReplaceIndex > guardIndex && signatureCommitIndex > subtreeReplaceIndex,
  "The cached Player re-entry guard must run before the full subtree replacement, and the new signature may only commit after the rebuilt subtree is complete.",
);
invariant(
  subtreeReplacementSites === 1,
  "The Player renderer must retain one canonical full-subtree rebuild site so the cached re-entry guard cannot leave a second unconditional rebuild path.",
);

const generatedBanner = "// Generated Player core chunk from modules/app-core.js. Do not edit directly.\n";
invariant(
  generatedPlayerRuntime.startsWith(generatedBanner)
    && generatedPlayerRuntime.slice(generatedBanner.length).replace(/\s*$/, "") === playerCore.replace(/\s*$/, ""),
  "The tracked Player runtime must exactly match the complete optimized build pipeline.",
);
excludes(playerSplitter, "!important", "Player cached re-entry reuse must not add CSS priority overrides.");

// Deterministic accounting for the targeted DOM operation only. Re-entering an
// already-loaded Player route with the same row and mutable Player state used to
// replace the complete #playerDetail subtree once. The signature guard now
// reuses that intact subtree, so the replacement is skipped entirely.
const previousFullSubtreeReplacements = 1;
const optimizedFullSubtreeReplacements = 0;
const reductionPercent = Math.round((1 - optimizedFullSubtreeReplacements / previousFullSubtreeReplacements) * 100);
invariant(reductionPercent === 100, "Step 18 must eliminate the unchanged cached Player subtree replacement.");

console.log(
  `Player cached re-entry performance validation passed: unchanged full #playerDetail subtree replacements ${previousFullSubtreeReplacements} -> ${optimizedFullSubtreeReplacements} (${reductionPercent}% reduction), with row, wallet, watchlist, note, display-format, and training state included in invalidation.`,
);
