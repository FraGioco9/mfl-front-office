import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [source, evaluationLoadLifecycle, runtime, loadingStyles] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-evaluation-load-lifecycle.js"),
  read("./modules/app-core-runtime.js"),
  read("./loading.css"),
]);

invariant(
  !evaluationLoadLifecycle.includes("normalizeModalEntranceLifecycle")
    && !evaluationLoadLifecycle.includes("modalArtifacts")
    && evaluationLoadLifecycle.includes('const source = String(artifacts?.core || "");')
    && evaluationLoadLifecycle.includes("const routeChunks = { ...(artifacts?.routeChunks || {}) };")
    && evaluationLoadLifecycle.includes("...artifacts,"),
  "Evaluation Load normalization must consume source-owned modal behavior directly from the incoming artifacts.",
);

for (const modalSource of [source, runtime]) {
  invariant(
    modalSource.includes('modal.classList.remove("modalClosing", "modalOpen");')
      && modalSource.includes("window.requestAnimationFrame(() => {\n    window.requestAnimationFrame(() => {\n      modal.classList.add(\"modalOpen\");"),
    "Modal opening must preserve one painted closed-state frame before modalOpen is applied.",
  );
}

const busyPointerRule = loadingStyles.match(
  /html\.mflInteractionBusy body \*,\nhtml\.mflInteractionBusy body \*::before,\nhtml\.mflInteractionBusy body \*::after \{([^}]*)\}/,
)?.[1] || "";
invariant(
  busyPointerRule
    && !busyPointerRule.includes("transition: none;")
    && loadingStyles.includes("*:not(.modalBackdrop, .modalBackdrop *)")
    && loadingStyles.includes("transition: none;"),
  "Busy loading must suppress ordinary transitions without suppressing modal entrance transitions.",
);

console.log("Source-owned modal first-open paint boundary and busy-state transition preservation validation passed.");
