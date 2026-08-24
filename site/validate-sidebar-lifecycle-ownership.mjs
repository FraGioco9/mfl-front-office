import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};


const [coreSource, sidebarNormalizer, routeSplitter, buildNormalizer, styles, responsive, index] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-sidebar-lifecycle.js"),
  read("./modules/app-core-route-chunks.js"),
  read("./modules/app-core-build-normalizer.js"),
  read("./styles-base.css"),
  read("./responsive.css"),
  read("./index.html"),
]);
const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
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
  "setPageWithoutRouteLoading",
]) {
  invariant(!builtRuntime.includes(staleOwner), `Built runtime must not contain legacy pinned-sidebar ownership: ${staleOwner}`);
}

invariant(
  shared.includes(`function updateMenuVisibility() {\n  state.menuOpen = true;`),
  "Built shared core must force the pinned sidebar expanded at its canonical visibility owner.",
);
invariant(
  shared.includes('  appShell.classList.remove("menuClosed");'),
  "Built shared core must remove obsolete collapsed-shell state directly.",
);
invariant(
  shared.includes("  menuButton.disabled = true;\n  menuButton.tabIndex = -1;"),
  "Built shared core must own the disabled pinned-sidebar menu button.",
);
invariant(
  shared.includes('  menuButton.setAttribute("aria-disabled", "true");\n  menuButton.setAttribute("aria-expanded", "true");'),
  "Built shared core must own pinned-sidebar accessibility state.",
);
invariant(
  shared.includes(`function toggleMenu() {\n  updateMenuVisibility();\n}`),
  "Built runtime must not retain animated/collapsible menu-toggle behavior.",
);
invariant(
  shared.includes(`function restoreMenuState() {\n  state.menuOpen = true;\n}`),
  "Built runtime must ignore historic persisted collapsed-menu state.",
);
invariant(
  !builtRuntime.includes("keepSidebarExpanded();"),
  "Built runtime page transitions must not depend on the legacy sidebar helper.",
);
invariant(
  shared.includes("function sidebarNavigationOptions(pageName) {")
    && shared.includes("async function navigateSidebarButton(button) {")
    && shared.includes('  const button = event.target.closest("#sidebar .navButton[data-page]");')
    && shared.includes("  await setPage(pageName, true, options);"),
  "Built shared core must delegate every sidebar destination through one owner that resolves the current setPage route owner at activation time.",
);
invariant(
  !shared.includes('navButtons.forEach((button) => {\n  button.addEventListener("click", async (event) => {'),
  "Built shared core must not bind sidebar navigation to startup-time per-button click handlers.",
);
invariant(
  (shared.match(/#sidebar \.navButton\[data-page\]/g) || []).length === 1,
  "Built shared core must bind exactly one delegated sidebar page-navigation selector.",
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
  sidebarNormalizer.includes("export function normalizePinnedSidebarApplicationCoreRuntime(source)"),
  "Pinned-sidebar cleanup must use the dedicated structural owner.",
);
invariant(
  sidebarNormalizer.includes("canonical delegated sidebar navigation")
    && sidebarNormalizer.includes("CANONICAL_SIDEBAR_NAVIGATION_BINDING"),
  "Pinned-sidebar lifecycle normalization must own the delegated navigation contract instead of adding a runtime repair layer.",
);
invariant(
  routeSplitter.includes("let core = normalizePinnedSidebarApplicationCoreRuntime(source);"),
  "Pinned-sidebar compatibility ownership must be removed inside the canonical route splitter.",
);
invariant(
  buildNormalizer.includes("splitApplicationCoreRuntime(canonicalSource)"),
  "The build must continue splitting canonical app-core source directly without a pre-split patch chain.",
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
    && responsive.includes("  .settingsNavButton {\n    align-self: center;\n    margin: 0 0 0 auto;\n  }"),
  "Mobile navigation must flatten the desktop grid wrapper and preserve the existing horizontal Settings placement.",
);

new Function(shared);
for (const chunk of Object.values(artifacts.routeChunks || {})) new Function(String(chunk || ""));
console.log("Built pinned-sidebar lifecycle, delegated refresh-safe navigation, stable white Menu color, and sidebar grid geometry are canonical without runtime monkey-patching, CSS priority overrides, or competing layout owners.");
