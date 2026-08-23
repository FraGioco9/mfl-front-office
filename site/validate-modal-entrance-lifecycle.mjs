import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [evaluationLoadLifecycle, normalizer, runtime, loadingStyles] = await Promise.all([
  read("./modules/app-core-evaluation-load-lifecycle.js"),
  read("./modules/app-core-modal-entrance-lifecycle.js"),
  read("./modules/app-core-runtime.js"),
  read("./loading.css"),
]);

invariant(
  evaluationLoadLifecycle.includes('import { normalizeModalEntranceLifecycle } from "./app-core-modal-entrance-lifecycle.js";')
    && evaluationLoadLifecycle.includes("const modalArtifacts = normalizeModalEntranceLifecycle(artifacts);")
    && evaluationLoadLifecycle.includes("...modalArtifacts,"),
  "Evaluation Load normalization must apply the canonical modal entrance lifecycle inside the shared core pipeline.",
);

for (const source of [normalizer, runtime]) {
  invariant(
    source.includes('modal.classList.remove("modalClosing", "modalOpen");')
      && source.includes("window.requestAnimationFrame(() => {\n    window.requestAnimationFrame(() => {\n      modal.classList.add(\"modalOpen\");"),
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

console.log("Modal first-open paint boundary and busy-state transition preservation validation passed.");
