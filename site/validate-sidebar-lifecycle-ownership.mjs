import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [coreSource, sidebarNormalizer, routeSplitter, buildNormalizer, styles] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-sidebar-lifecycle.js"),
  read("./modules/app-core-route-chunks.js"),
  read("./modules/app-core-build-normalizer.js"),
  read("./styles-base.css"),
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
  styles.includes(".menuButton {")
    && styles.includes("  pointer-events: none;")
    && styles.includes("  cursor: default;"),
  "Static CSS must retain non-interactive pinned-sidebar menu-button presentation.",
);
invariant(
  sidebarNormalizer.includes("export function normalizePinnedSidebarApplicationCoreRuntime(source)"),
  "Pinned-sidebar cleanup must use the dedicated structural owner.",
);
invariant(
  routeSplitter.includes("let core = normalizePinnedSidebarApplicationCoreRuntime(source);"),
  "Pinned-sidebar compatibility ownership must be removed inside the canonical route splitter.",
);
invariant(
  buildNormalizer.includes("splitApplicationCoreRuntime(canonicalSource)"),
  "The build must continue splitting canonical app-core source directly without a pre-split patch chain.",
);

new Function(shared);
for (const chunk of Object.values(artifacts.routeChunks || {})) new Function(String(chunk || ""));
console.log("Built pinned-sidebar lifecycle is canonical inside the direct route splitter without runtime monkey-patching, animation ownership, or inline presentation overrides.");
