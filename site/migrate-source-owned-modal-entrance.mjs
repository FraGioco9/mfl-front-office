// Temporary one-shot migration; remove before merge.
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const siteRoot = resolve(import.meta.dirname);
const read = async (path) => String(await readFile(resolve(siteRoot, path), "utf8")).replace(/\r\n?/g, "\n");
const replaceRequired = (source, before, after, label) => {
  if (!source.includes(before)) throw new Error(`Missing ${label}.`);
  return source.replace(before, after);
};

const singleFrame = `function showModal(modal) {
  if (!modal) {
    return;
  }

  modal.classList.remove("modalClosing");
  modal.hidden = false;
  window.requestAnimationFrame(() => {
    modal.classList.add("modalOpen");
  });
}`;
const paintBoundary = `function showModal(modal) {
  if (!modal) {
    return;
  }

  modal.classList.remove("modalClosing", "modalOpen");
  modal.hidden = false;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      modal.classList.add("modalOpen");
    });
  });
}`;

let core = await read("modules/app-core.js");
core = replaceRequired(core, singleFrame, paintBoundary, "canonical showModal single-frame entrance");
await writeFile(resolve(siteRoot, "modules/app-core.js"), core);

let evaluationLoad = await read("modules/app-core-evaluation-load-lifecycle.js");
evaluationLoad = replaceRequired(
  evaluationLoad,
  'import { normalizeModalEntranceLifecycle } from "./app-core-modal-entrance-lifecycle.js";\n',
  "",
  "modal entrance normalizer import",
);
evaluationLoad = replaceRequired(
  evaluationLoad,
  `export function normalizeEvaluationLoadLifecycle(artifacts) {
  const modalArtifacts = normalizeModalEntranceLifecycle(artifacts);
  const source = String(modalArtifacts?.core || "");`,
  `export function normalizeEvaluationLoadLifecycle(artifacts) {
  const source = String(artifacts?.core || "");`,
  "Evaluation Load modal artifact setup",
);
evaluationLoad = replaceRequired(
  evaluationLoad,
  "  const routeChunks = { ...(modalArtifacts?.routeChunks || {}) };",
  "  const routeChunks = { ...(artifacts?.routeChunks || {}) };",
  "Evaluation Load route chunk artifact source",
);
evaluationLoad = replaceRequired(
  evaluationLoad,
  `  return Object.freeze({
    ...modalArtifacts,
    core,`,
  `  return Object.freeze({
    ...artifacts,
    core,`,
  "Evaluation Load returned artifact source",
);
await writeFile(resolve(siteRoot, "modules/app-core-evaluation-load-lifecycle.js"), evaluationLoad);

const validator = `import { readFile } from "node:fs/promises";

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
      && modalSource.includes("window.requestAnimationFrame(() => {\\n    window.requestAnimationFrame(() => {\\n      modal.classList.add(\\\"modalOpen\\\");"),
    "Modal opening must preserve one painted closed-state frame before modalOpen is applied.",
  );
}

const busyPointerRule = loadingStyles.match(
  /html\\.mflInteractionBusy body \\*,\\nhtml\\.mflInteractionBusy body \\*::before,\\nhtml\\.mflInteractionBusy body \\*::after \\{([^}]*)\\}/,
)?.[1] || "";
invariant(
  busyPointerRule
    && !busyPointerRule.includes("transition: none;")
    && loadingStyles.includes("*:not(.modalBackdrop, .modalBackdrop *)")
    && loadingStyles.includes("transition: none;"),
  "Busy loading must suppress ordinary transitions without suppressing modal entrance transitions.",
);

console.log("Source-owned modal first-open paint boundary and busy-state transition preservation validation passed.");
`;
await writeFile(resolve(siteRoot, "validate-modal-entrance-lifecycle.mjs"), validator);
await rm(resolve(siteRoot, "modules/app-core-modal-entrance-lifecycle.js"));
console.log("Canonical modal entrance lifecycle migration applied.");
