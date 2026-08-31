import { readFile } from "node:fs/promises";

import { readCanonicalCoreArtifacts } from "./validate-core-sources.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [coreSource, styles, responsive, index] = await Promise.all([
  Promise.all([
    read("./modules/core-sources/shared.js"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
  read("./styles-base.css"),
  read("./responsive.css"),
  read("./index.html"),
]);
const artifacts = readCanonicalCoreArtifacts(coreSource);
const shared = String(artifacts.core || "");
const builtRuntime = [shared, ...Object.values(artifacts.routeChunks || {}).map(String)].join("\n");

for (const staleOwner of [
  "function keepSidebarExpanded()",
  "permanentlyExpandedMenu",
  "menuAnimationTimer",
  'classList.add("menuAnimating")',
  'classList.add("menuOpen")',
  '"sidebarClosed"',
  '"sidebarCollapsed"',
  "menuButton.style.pointerEvents",
  "menuButton.style.cursor",
  "normalizePinnedSidebarApplicationCoreRuntime",
]) {
  invariant(!builtRuntime.includes(staleOwner), `Canonical runtime must not contain legacy pinned-sidebar ownership: ${staleOwner}`);
}

invariant(
  shared.includes(`function updateMenuVisibility() {\n  state.menuOpen = true;`),
  "Canonical shared source must force the pinned sidebar expanded at its visibility owner.",
);
invariant(
  shared.includes('  appShell.classList.remove("menuClosed");'),
  "Canonical shared source must remove obsolete collapsed-shell state directly.",
);
invariant(
  shared.includes("  menuButton.disabled = true;\n  menuButton.tabIndex = -1;"),
  "Canonical shared source must own the disabled pinned-sidebar menu button.",
);
invariant(
  shared.includes('  menuButton.setAttribute("aria-disabled", "true");\n  menuButton.setAttribute("aria-expanded", "true");'),
  "Canonical shared source must own pinned-sidebar accessibility state.",
);
invariant(
  shared.includes(`function toggleMenu() {\n  updateMenuVisibility();\n}`),
  "Canonical runtime must not retain animated/collapsible menu-toggle behavior.",
);
invariant(
  shared.includes(`function restoreMenuState() {\n  state.menuOpen = true;\n}`),
  "Canonical runtime must ignore historic persisted collapsed-menu state.",
);
invariant(
  !builtRuntime.includes("keepSidebarExpanded();"),
  "Canonical page transitions must not depend on the legacy sidebar helper.",
);
invariant(
  styles.includes(".menuButton {")
    && styles.includes("  color: #ffffff;\n  padding: 0;")
    && styles.includes("  pointer-events: none;")
    && styles.includes("  cursor: default;")
    && styles.includes(".menuButton:hover:not(:disabled) {\n  border-color: transparent;\n  background: transparent;\n  color: #ffffff;"),
  "Static CSS must keep the pinned Menu label white and non-interactive before and after hydration.",
);
invariant(
  styles.includes("button:disabled:not(.menuButton) {\n  cursor: not-allowed;\n  opacity: 0.45;\n}")
    && !styles.includes("button:disabled {\n  cursor: not-allowed;\n  opacity: 0.45;\n}"),
  "The global disabled-button fade must exclude the permanently disabled pinned Menu control.",
);
invariant(
  !coreSource.includes("app-core-sidebar-lifecycle")
    && !coreSource.includes("app-core-route-chunks")
    && !coreSource.includes("app-core-build-normalizer"),
  "Pinned-sidebar behavior must remain directly authored in canonical core sources without retired transform ownership.",
);

invariant(
  index.includes('<aside id="sidebar" class="sidebar">\n          <div class="sidebarGrid">')
    && index.includes('</div>\n          <a class="navButton settingsNavButton"'),
  "Desktop sidebar navigation buttons must be grouped by the canonical sidebar grid while Settings remains independently bottom-anchored.",
);
invariant(
  styles.includes(".sidebar {\n  width: 162px;")
    && styles.includes("  display: grid;\n  grid-template-rows: auto minmax(0, 1fr) auto;"),
  "Desktop sidebar must retain its 162px width and use the canonical three-row grid shell.",
);
invariant(
  styles.includes(".sidebarGrid {\n  display: grid;\n  grid-auto-rows: 40px;\n  gap: 8px;"),
  "Sidebar page boxes must retain 40px rows with the existing 8px spacing.",
);
invariant(
  styles.includes(".navButton {\n  display: grid;\n  grid-template-columns: 18px minmax(0, 1fr);\n  align-items: center;\n  justify-items: start;")
    && styles.includes("  height: 40px;\n  margin: 0;"),
  "Sidebar page boxes must keep their 40px height and vertically center their two-cell icon/label grid.",
);
invariant(
  styles.includes(".navEmoji {\n  display: grid;\n  place-items: center;\n  align-self: center;\n  justify-self: center;\n  width: 18px;\n  height: 18px;"),
  "Sidebar icons must use a fixed centered 18px cell instead of intrinsic SVG height.",
);
invariant(
  styles.includes(".navText {\n  display: flex;\n  align-items: center;\n  align-self: center;\n  min-height: 20px;\n  max-width: 112px;\n  opacity: 1;\n  line-height: 1.2;\n  white-space: nowrap;")
    && !styles.includes(".navText {\n  display: flex;\n  align-items: center;\n  align-self: center;\n  height: 18px;"),
  "Sidebar page labels must stay vertically centered without a hard-height box that clips font descenders.",
);
invariant(
  styles.includes(".settingsNavButton {\n  grid-row: 3;\n  align-self: end;\n  margin: 0 0 8px;"),
  "Settings must remain anchored at the bottom of the desktop sidebar with its existing bottom spacing.",
);
invariant(
  responsive.includes("  .sidebarGrid {\n    display: contents;\n  }")
    && responsive.includes("  .menuRail .navButton {\n    display: flex;\n    flex: 1 1 0;\n    flex-direction: column;")
    && responsive.includes("  .menuRail .settingsNavButton {\n    align-self: stretch;\n    margin: 0;\n  }"),
  "Mobile navigation must flatten the desktop grid wrapper and distribute every existing destination, including Settings, evenly in the bottom rail.",
);

new Function(shared);
for (const chunk of Object.values(artifacts.routeChunks || {})) new Function(String(chunk || ""));
console.log("Source-owned pinned-sidebar lifecycle, desktop sidebar grid geometry, and mobile bottom-rail geometry are canonical without runtime monkey-patching, CSS priority overrides, or competing layout owners.");
