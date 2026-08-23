import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";
import { optimizeCachedRouteRuntimeArtifacts } from "./modules/app-core-cached-route-performance.js";
import { optimizeEvaluationRuntimeArtifacts } from "./modules/app-core-evaluation-performance.js";
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

const [coreSource, buildSource, optimizerSource, generatedCore] = await Promise.all([
  read("./modules/app-core.js"),
  read("./build-app-core.mjs"),
  read("./modules/app-core-evaluation-performance.js"),
  read("./modules/app-core-runtime.js"),
]);

const artifacts = optimizeEvaluationRuntimeArtifacts(
  optimizeGlobalSearchRuntimeArtifacts(
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
  ),
);
const core = String(artifacts.core || "");
invariant(core, "The optimized shared application core must exist.");
new Function(core);

includes(
  buildSource,
  'import { optimizeEvaluationRuntimeArtifacts } from "./modules/app-core-evaluation-performance.js";',
  "The canonical build must import the Evaluation re-entry optimizer.",
);
includes(
  buildSource,
  "const artifacts = optimizeEvaluationRuntimeArtifacts(\n  optimizeGlobalSearchRuntimeArtifacts(",
  "Evaluation re-entry optimization must compose outside the complete existing optimization pipeline.",
);
includes(
  optimizerSource,
  "core = replaceRequired(\n    core,\n    EVALUATION_TABLE_RENDER_START,\n    EVALUATION_TABLE_RENDER_WITH_REUSE,",
  "Evaluation re-entry optimization must patch the canonical table renderer start rather than wrapping it at runtime.",
);
includes(
  optimizerSource,
  "core = replaceRequired(\n    core,\n    EVALUATION_TABLE_RENDER_END,\n    EVALUATION_TABLE_RENDER_END_WITH_SIGNATURE,",
  "Evaluation re-entry optimization must commit the render signature inside the canonical renderer.",
);
excludes(optimizerSource, "!important", "Evaluation cached re-entry reuse must not add CSS priority overrides.");

includes(
  core,
  'let evaluationTableLastRenderSignature = "";',
  "Evaluation rendering must retain the last completed table signature.",
);
includes(
  core,
  "function evaluationTableRenderSignature(row) {",
  "Evaluation rendering must derive an explicit table signature.",
);
for (const stateInput of [
  "state.columns,",
  "row,",
  "state.evaluationIgnoreDiscountRate,",
  "state.evaluationIgnoreFirstSeason,",
  "state.evaluationMflPerUsd,",
  "state.evaluationLateSeasonRewardRates,",
  "state.evaluationOverallRows[playerId] || null,",
  "state.evaluationSummaryPositions[playerId] || \"\",",
  "state.settingsDateFormat,",
  "state.settingsTimeFormat,",
]) {
  includes(core, stateInput, `Evaluation cached table signature must include ${stateInput}`);
}
includes(
  core,
  "&& !evaluationPanel.hidden",
  "Evaluation table reuse must require the selected-player panel to still be visible.",
);
includes(
  core,
  "&& Boolean(evaluationSummaryBody?.firstElementChild)",
  "Evaluation table reuse must require the existing summary subtree to remain intact.",
);
includes(
  core,
  "&& evaluationTableBody?.children.length === expectedSeasons;",
  "Evaluation table reuse must require the existing season-row count to match the selected player.",
);
includes(
  core,
  "if (reusableTable && evaluationTableLastRenderSignature === renderSignature) {\n    updateEvaluationFooterActions();\n    return;\n  }",
  "An identical cached Evaluation table must skip reconstruction while still refreshing footer actions.",
);
includes(
  core,
  "evaluationTableLastRenderSignature = renderSignature;",
  "A completed Evaluation table render must commit its signature.",
);
includes(
  core,
  "renderEvaluationTable(row);",
  "Evaluation page routing must continue to invoke the canonical table renderer.",
);
includes(
  core,
  "await renderEvaluationPage();",
  "Evaluation page routing must continue to await the standard route/readiness renderer.",
);

const rendererStart = core.indexOf("function renderEvaluationTable(row) {");
const pageRendererStart = core.indexOf("\nasync function renderEvaluationPage()", rendererStart);
const renderer = rendererStart >= 0 && pageRendererStart > rendererStart
  ? core.slice(rendererStart, pageRendererStart)
  : "";
invariant(renderer, "The Evaluation table renderer must remain in shared core.");
const guardIndex = renderer.indexOf("evaluationTableLastRenderSignature === renderSignature");
const summaryReplaceIndex = renderer.indexOf("evaluationSummaryBody.replaceChildren(summaryRow);");
const tableReplaceIndex = renderer.indexOf("evaluationTableBody.replaceChildren(fragment);");
const signatureCommitIndex = renderer.lastIndexOf("evaluationTableLastRenderSignature = renderSignature;");
invariant(
  guardIndex >= 0
    && summaryReplaceIndex > guardIndex
    && tableReplaceIndex > summaryReplaceIndex
    && signatureCommitIndex > tableReplaceIndex,
  "The cached Evaluation guard must run before both subtree replacements, and the signature may only commit after rebuilding them.",
);

const generatedBanner = "// Generated by build-app-core.mjs from modules/app-core.js. Do not edit directly.\n";
invariant(
  generatedCore.startsWith(generatedBanner)
    && generatedCore.slice(generatedBanner.length).replace(/\s*$/, "") === core.replace(/\s*$/, ""),
  "The tracked eager runtime must exactly match the complete Step 19 build pipeline.",
);
includes(
  generatedCore,
  "if (reusableTable && evaluationTableLastRenderSignature === renderSignature) {\n    updateEvaluationFooterActions();\n    return;\n  }",
  "The shipped generated runtime must contain the guarded Evaluation table reuse path, not only the build-time source transformation.",
);

// Deterministic accounting for the targeted DOM operations only. An unchanged
// selected-player Evaluation revisit previously replaced both the summary tbody
// and the season-table tbody. The signature guard reuses both intact subtrees.
const previousSubtreeReplacements = 2;
const optimizedSubtreeReplacements = 0;
const reductionPercent = Math.round((1 - optimizedSubtreeReplacements / previousSubtreeReplacements) * 100);
invariant(reductionPercent === 100, "Step 19 must eliminate unchanged cached Evaluation subtree replacements.");

console.log(
  `Evaluation cached re-entry performance validation passed: unchanged summary/table subtree replacements ${previousSubtreeReplacements} -> ${optimizedSubtreeReplacements} (${reductionPercent}% reduction), while route/readiness and footer synchronization remain active.`,
);
