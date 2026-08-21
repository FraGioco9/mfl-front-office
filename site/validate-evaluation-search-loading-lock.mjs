import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [searchRuntime, bootstrapCore] = await Promise.all([
  read("./evaluation-search-state-runtime.js"),
  read("./bootstrap-core.js"),
]);

for (const required of [
  "function evaluationSearchLocked(snapshot = loadingSnapshot())",
  "return active() && Boolean(snapshot?.busy);",
  "function syncLoadingLock(snapshot = loadingSnapshot())",
  "field.readOnly = locked;",
  'field.setAttribute("aria-busy", "true");',
  "clear.disabled = locked;",
  'document.querySelectorAll("#evaluationSearchResults .evaluationSearchResult")',
  "button.disabled = locked;",
  "function blockSearchInteractionWhileLoading(event)",
  'target?.closest(".evaluationSearch")',
  "event.preventDefault();",
  "event.stopImmediatePropagation();",
  'document.addEventListener("keydown", blockSearchInteractionWhileLoading, true);',
  'document.addEventListener("keyup", blockSearchInteractionWhileLoading, true);',
  'document.addEventListener("beforeinput", blockSearchInteractionWhileLoading, true);',
  "window.__mflInteractionBusy?.subscribe?.((snapshot) => {",
  "if (!destroyed) syncLoadingLock(snapshot);",
  "unsubscribeLoadingState?.();",
]) {
  invariant(searchRuntime.includes(required), `Evaluation search loading lock is missing ${required}`);
}

invariant(
  bootstrapCore.includes('const blockedEvents = [\n      "pointerdown", "mousedown", "touchstart", "click", "dblclick", "auxclick", "contextmenu",')
    && !bootstrapCore.includes('"keydown", "keyup", "beforeinput"'),
  "Keyboard blocking must remain scoped to the Evaluation search runtime instead of expanding the global pointer blocker.",
);

console.log("Evaluation search loading lock validation passed.");
