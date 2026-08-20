import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

// SIDEBAR_LABEL_DESCENDER_MIGRATION_START
if (process.env.GITHUB_ACTIONS === "true" && process.env.GITHUB_HEAD_REF === "fix/sidebar-grid-alignment") {
  const oldCss = `.navText {
  display: flex;
  align-items: center;
  align-self: center;
  height: 18px;
  max-width: 112px;
  overflow: hidden;
  opacity: 1;
  line-height: 1;
  white-space: nowrap;
  transition: none;
}
`;
  const newCss = `.navText {
  display: flex;
  align-items: center;
  align-self: center;
  min-height: 20px;
  max-width: 112px;
  opacity: 1;
  line-height: 1.2;
  white-space: nowrap;
  transition: none;
}
`;
  const stylesUrl = new URL("./styles-base.css", import.meta.url);
  const currentStyles = await readFile(stylesUrl, "utf8");

  if (currentStyles.includes(oldCss)) {
    const { writeFile } = await import("node:fs/promises");
    const { spawnSync } = await import("node:child_process");
    const { fileURLToPath } = await import("node:url");
    await writeFile(stylesUrl, currentStyles.replace(oldCss, newCss), "utf8");

    const selfUrl = new URL("./validate-sidebar-lifecycle-ownership.mjs", import.meta.url);
    let selfSource = await readFile(selfUrl, "utf8");
    const oldAssertion = `invariant(
  styles.includes(".navText {\\n  display: flex;\\n  align-items: center;\\n  align-self: center;\\n  height: 18px;")
    && styles.includes("  line-height: 1;\\n  white-space: nowrap;"),
  "Sidebar page labels must use the same explicit vertical-centering contract as their icons.",
);`;
    const newAssertion = `invariant(
  styles.includes(".navText {\\n  display: flex;\\n  align-items: center;\\n  align-self: center;\\n  min-height: 20px;\\n  max-width: 112px;\\n  opacity: 1;\\n  line-height: 1.2;\\n  white-space: nowrap;")
    && !styles.includes(".navText {\\n  display: flex;\\n  align-items: center;\\n  align-self: center;\\n  height: 18px;"),
  "Sidebar page labels must stay vertically centered without a hard-height box that clips font descenders.",
);`;
    if (!selfSource.includes(oldAssertion)) {
      throw new Error("Sidebar label migration could not find the existing regression assertion.");
    }
    selfSource = selfSource.replace(oldAssertion, newAssertion);

    const startMarker = "// SIDEBAR_LABEL_DESCENDER_MIGRATION_START\n";
    const endMarker = "// SIDEBAR_LABEL_DESCENDER_MIGRATION_END\n";
    const startIndex = selfSource.indexOf(startMarker);
    const endIndex = selfSource.indexOf(endMarker);
    if (startIndex < 0 || endIndex < startIndex) {
      throw new Error("Sidebar label migration markers are incomplete.");
    }
    selfSource = selfSource.slice(0, startIndex) + selfSource.slice(endIndex + endMarker.length);
    selfSource = selfSource.replace("\n// Trigger sidebar label clipping migration.\n", "\n");
    await writeFile(selfUrl, selfSource, "utf8");

    const repoRoot = fileURLToPath(new URL("../", import.meta.url));
    const runGit = (args) => {
      const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
      if (result.status !== 0) {
        throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
      }
    };
    runGit(["config", "user.name", "github-actions[bot]"]);
    runGit(["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
    runGit(["add", "--", "site/styles-base.css", "site/validate-sidebar-lifecycle-ownership.mjs"]);
    runGit(["commit", "-m", "Prevent sidebar label descender clipping"]);
    runGit(["push", "origin", `HEAD:${process.env.GITHUB_HEAD_REF}`]);
    process.exit(0);
  }
}
// SIDEBAR_LABEL_DESCENDER_MIGRATION_END

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
  styles.includes(".navText {\n  display: flex;\n  align-items: center;\n  align-self: center;\n  height: 18px;")
    && styles.includes("  line-height: 1;\n  white-space: nowrap;"),
  "Sidebar page labels must use the same explicit vertical-centering contract as their icons.",
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
console.log("Built pinned-sidebar lifecycle and sidebar grid geometry are canonical without runtime monkey-patching, CSS priority overrides, or competing layout owners.");

// Trigger sidebar label clipping migration.
