import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [source, buildNormalizer, runtime, loadingStyles] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-build-normalizer.js"),
  read("./modules/app-core-runtime.js"),
  read("./loading.css"),
]);

invariant(
  !buildNormalizer.includes("normalizeModalEntranceLifecycle")
    && !buildNormalizer.includes("modalArtifacts")
    && !buildNormalizer.includes("normalizeEvaluationLoadLifecycle")
    && !buildNormalizer.includes("evaluationLoadArtifacts")
    && !buildNormalizer.includes("normalizeEvaluationSavedValuationCache")
    && buildNormalizer.includes("return watchlistArtifacts;"),
  "Build composition must consume source-owned modal and Evaluation Load behavior directly before the remaining Saved Valuation Cache transform.",
);

for (const modalSource of [source, runtime]) {
  invariant(
    modalSource.includes('modal.classList.remove("modalClosing", "modalOpen");')
      && modalSource.includes("window.requestAnimationFrame(() => {\n    window.requestAnimationFrame(() => {\n      modal.classList.add(\"modalOpen\");"),
    "Modal opening must preserve one painted closed-state frame before modalOpen is applied.",
  );
}

console.log("Source-owned modal first-open paint boundary and busy-state transition preservation validation passed.");
invariant(!loadingStyles.includes("mflInteractionBusy"), "Modal entrance transitions must not depend on a retired global operation-busy CSS owner.");

console.log("Source-owned modal first-open paint boundary remains independent from loading-state transition suppression.");
