import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const siteRoot = dirname(fileURLToPath(import.meta.url));
const source = await Promise.all([
    readFile(join(siteRoot, "modules/core-sources/shared.js"), "utf8"),
    readFile(join(siteRoot, "modules/core-sources/evaluation.js"), "utf8"),
    readFile(join(siteRoot, "modules/core-sources/mfl-stats.js"), "utf8"),
    readFile(join(siteRoot, "modules/core-sources/club.js"), "utf8"),
    readFile(join(siteRoot, "modules/core-sources/settings.js"), "utf8"),
    readFile(join(siteRoot, "modules/core-sources/player.js"), "utf8"),
    readFile(join(siteRoot, "modules/core-sources/table.js"), "utf8"),
    readFile(join(siteRoot, "modules/core-sources/wallet.js"), "utf8"),
    readFile(join(siteRoot, "modules/core-sources/watchlist.js"), "utf8"),
  ]).then((parts) => parts.join("\n"));

invariant(
  source.includes("evaluationMflPerUsdRevision: 0,"),
  "Evaluation state must track MFL/USD commit revisions.",
);
invariant(
  source.includes("function commitEvaluationMflPerUsdValue(value) {")
    && source.includes("state.evaluationMflPerUsdRevision += 1;"),
  "User MFL/USD commits must advance the canonical revision.",
);
invariant(
  (source.match(/commitEvaluationMflPerUsdValue\(parsedValue\);/g) || []).length === 2,
  "Both main and Advanced Settings MFL/USD commits must use revision-aware ownership.",
);
invariant(
  source.includes("commitEvaluationMflPerUsdValue(DEFAULT_EVALUATION_MFL_PER_USD);"),
  "Resetting MFL/USD must advance the same revision used by normal edits.",
);
invariant(
  source.includes("const evaluationMflPerUsdRevisionAtLoadStart = state.evaluationMflPerUsdRevision;"),
  "Async Evaluation settings loads must snapshot the MFL/USD revision before awaiting data.",
);
invariant(
  source.includes("const preserveLatestMflPerUsd = state.evaluationMflPerUsdRevision !== evaluationMflPerUsdRevisionAtLoadStart;")
    && source.includes("if (preserveLatestMflPerUsd) {\n          state.evaluationMflPerUsd = latestMflPerUsd;\n        }"),
  "Wallet settings hydration must preserve a newer MFL/USD edit or reset.",
);
invariant(
  (source.match(/mflPerUsdRevisionAtLoadStart: evaluationMflPerUsdRevisionAtLoadStart/g) || []).length === 2,
  "Saved and shared Evaluation loads must pass their start revision into payload hydration.",
);
invariant(
  source.includes("state.evaluationMflPerUsdRevision !== mflPerUsdRevisionAtLoadStart")
    && source.includes("state.evaluationMflPerUsd = latestMflPerUsd;"),
  "Saved/shared payload hydration must restore the latest committed MFL/USD value before rendering.",
);

console.log("Evaluation MFL/USD loading-race validation passed: edits and resets retain latest-value ownership across wallet, saved, and shared async hydration.");
