import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);

const [bootstrap, staticUi, core] = await Promise.all([
  read("./bootstrap.js"),
  read("./static-ui-runtime.js"),
  read("./modules/app-core.js"),
]);

includes(bootstrap, "primeViewButtons(normalizedPage, view);", "Bootstrap must keep priming the destination view set before data loading.");
includes(core, "window.__mflStaticUiRuntime?.syncTableViews?.(pageName, activeView);", "The application core must keep the shared static UI runtime as the table view-button owner.");
includes(staticUi, "function sharedViewOrderMatches(container, orderedButtons)", "Runtime view synchronization must detect an already-correct rendered order.");
includes(staticUi, "if (button.hidden !== shouldHide) button.hidden = shouldHide;", "Runtime view synchronization must leave unchanged visibility alone.");
includes(staticUi, "if (button.textContent !== label) button.textContent = label;", "Runtime view synchronization must leave an unchanged Attributes/Squad label alone.");
includes(staticUi, "if (!sharedViewOrderMatches(container, orderedButtons))", "Runtime view synchronization must guard DOM reordering behind an order mismatch.");

const guardIndex = staticUi.indexOf("if (!sharedViewOrderMatches(container, orderedButtons))");
const reorderIndex = staticUi.indexOf("container.insertBefore(button, switcher instanceof HTMLElement ? switcher : null);", guardIndex);
invariant(guardIndex >= 0 && reorderIndex > guardIndex, "View-button DOM movement must stay inside the idempotence guard.");

console.log("View-button refresh handoff validation passed: an already-correct first-paint button row is not rebuilt after loading.");
