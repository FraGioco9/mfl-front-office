import { access, readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [styles, controls, entry] = await Promise.all([
  read("./styles.css"),
  read("./controls.css"),
  read("./modules/app-entry.js"),
]);

invariant(
  styles.includes('@import url("/controls.css");'),
  "styles.css must load the canonical shared-control stylesheet.",
);
invariant(
  styles.indexOf('@import url("/controls.css");') > styles.indexOf('@import url("/dropdowns.css");'),
  "controls.css must load after dropdowns.css so shared control state has deterministic ownership.",
);

for (const required of [
  ".playerAttributeViewButton",
  "#sidebar .navButton.active",
  ".trainingStatControls button:hover:not(:disabled)",
  ".modalBackdrop .filtersHeader > .popupCloseButton",
  "html.mflInteractionBusy #pageSizeSelect",
]) {
  invariant(controls.includes(required), `controls.css is missing canonical shared rule: ${required}`);
}

invariant(!controls.includes("!important"), "controls.css must not introduce !important overrides.");

for (const duplicate of [
  "--mfl-popup-close-size:",
  "#sidebar .navButton.active",
  ".modalBackdrop .filtersHeader > .popupCloseButton",
  ".trainingStatControls .popupAddButton::before",
  "html.mflInteractionBusy #pageSizeSelect",
]) {
  invariant(!styles.includes(duplicate), `styles.css must not duplicate shared-control ownership through ${duplicate}`);
}

for (const removedRuntime of [
  "/table-view-runtime.js",
  "/table-navigation-chrome-runtime.js",
]) {
  invariant(!entry.includes(removedRuntime), `${removedRuntime} must not return to the table startup runtime list.`);
}

for (const path of ["./table-view-runtime.js", "./table-navigation-chrome-runtime.js"]) {
  let exists = true;
  try {
    await access(new URL(path, import.meta.url));
  } catch {
    exists = false;
  }
  invariant(!exists, `${path} must remain deleted; its behavior is canonical static CSS or no-op.`);
}

console.log("Canonical shared-control ownership and static table chrome validation passed.");
