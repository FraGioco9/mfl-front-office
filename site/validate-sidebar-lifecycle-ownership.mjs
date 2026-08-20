import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [coreSource, styles] = await Promise.all([
  read("./modules/app-core.js"),
  read("./styles-base.css"),
]);
const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const shared = String(artifacts.core || "");

for (const staleOwner of [
  "function keepSidebarExpanded()",
  "permanentlyExpandedMenu",
  "menuAnimationTimer",
  'classList.add("menuAnimating")',
  'classList.add("menuOpen")',
  '"sidebarClosed"',
  '"sidebarCollapsed"',
]) {
  invariant(!coreSource.includes(staleOwner), `Legacy sidebar runtime ownership must be removed: ${staleOwner}`);
  invariant(!shared.includes(staleOwner), `Generated shared core must not contain legacy sidebar ownership: ${staleOwner}`);
}

invariant(
  coreSource.includes(`function updateMenuVisibility() {\n  state.menuOpen = true;`),
  "Canonical menu visibility must force the pinned sidebar expanded at its source owner.",
);
invariant(
  coreSource.includes('  appShell.classList.remove("menuClosed");'),
  "Canonical menu visibility must remove the obsolete collapsed-shell state directly.",
);
invariant(
  coreSource.includes("  menuButton.disabled = true;\n  menuButton.tabIndex = -1;"),
  "Canonical menu visibility must own the disabled menu-button state.",
);
invariant(
  coreSource.includes('  menuButton.setAttribute("aria-disabled", "true");\n  menuButton.setAttribute("aria-expanded", "true");'),
  "Canonical menu visibility must own the menu-button accessibility state.",
);
invariant(
  coreSource.includes(`function toggleMenu() {\n  updateMenuVisibility();\n}`),
  "The legacy animated/collapsible toggle must be reduced to the canonical expanded-state refresh.",
);
invariant(
  coreSource.includes(`function restoreMenuState() {\n  state.menuOpen = true;\n}`),
  "Persisted historic collapsed state must not restore a closed sidebar.",
);
invariant(
  coreSource.includes("  function routeViewFromPath() {"),
  "Watchlist route-view behavior that shared the old sidebar IIFE must remain intact.",
);
invariant(
  !coreSource.includes("      keepSidebarExpanded();"),
  "Page transitions must no longer depend on a late sidebar patch.",
);
invariant(
  styles.includes(".menuButton {")
    && styles.includes("  pointer-events: none;")
    && styles.includes("  cursor: default;"),
  "Static CSS must retain the non-interactive pinned-sidebar menu-button presentation.",
);

new Function(shared);
console.log("Pinned sidebar state is canonical and no longer relies on runtime monkey-patching or animation ownership.");
