import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const mode = String(process.argv[2] || "").trim();
const siteRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(siteRoot, "..");
const headRef = String(process.env.GITHUB_HEAD_REF || "").trim();
const inMigrationCi = process.env.GITHUB_ACTIONS === "true" && /^chore\/canonical-sidebar-lifecycle-v\d+$/.test(headRef);

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: options.encoding ?? "utf8",
    stdio: options.stdio ?? "pipe",
  });
}

function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  const last = source.lastIndexOf(from);
  if (first < 0 || first !== last) {
    throw new Error(`${label}: expected exactly one source match.`);
  }
  return source.slice(0, first) + to + source.slice(first + from.length);
}

async function applyMigration() {
  if (inMigrationCi) {
    git(["checkout", "--detach", `origin/${headRef}`], { stdio: "inherit" });
  }

  const path = resolve(siteRoot, "modules/app-core.js");
  let source = (await readFile(path, "utf8")).replace(/\r\n?/g, "\n");

  source = replaceOnce(source, "  menuAnimationTimer: null,\n", "", "obsolete sidebar animation state");

  source = replaceOnce(
    source,
    `function updateMenuVisibility() {
  const showMenu = true;
  document.body.classList.toggle("guest", state.currentPage === "progression" && !hasProgressionAccess());
  menuRail.hidden = false;
  menuButton.hidden = false;
  sidebar.hidden = false;
  appShell.classList.toggle("menuClosed", !state.menuOpen);
  statusText.hidden = false;
  menuButton.setAttribute("aria-expanded", String(showMenu && state.menuOpen));
}`,
    `function updateMenuVisibility() {
  state.menuOpen = true;
  document.body.classList.toggle("guest", state.currentPage === "progression" && !hasProgressionAccess());
  menuRail.hidden = false;
  menuButton.hidden = false;
  sidebar.hidden = false;
  appShell.classList.remove("menuClosed");
  statusText.hidden = false;
  menuButton.disabled = true;
  menuButton.tabIndex = -1;
  menuButton.setAttribute("aria-disabled", "true");
  menuButton.setAttribute("aria-expanded", "true");
}`,
    "canonical menu visibility",
  );

  source = replaceOnce(
    source,
    `function toggleMenu() {
  appShell.classList.add("menuAnimating");
  window.clearTimeout(state.menuAnimationTimer);
  state.menuOpen = !state.menuOpen;
  updateMenuVisibility();
  state.menuAnimationTimer = window.setTimeout(() => {
    appShell.classList.remove("menuAnimating");
  }, 220);
  saveTableState();
}`,
    `function toggleMenu() {
  updateMenuVisibility();
}`,
    "canonical menu toggle",
  );

  source = replaceOnce(
    source,
    `function restoreMenuState(savedState) {
  if (typeof savedState?.menuOpen === "boolean") {
    state.menuOpen = savedState.menuOpen;
  }
}`,
    `function restoreMenuState() {
  state.menuOpen = true;
}`,
    "canonical persisted menu state",
  );

  const sidebarOwner = source.indexOf("  function keepSidebarExpanded() {");
  if (sidebarOwner < 0 || sidebarOwner !== source.lastIndexOf("  function keepSidebarExpanded() {")) {
    throw new Error("Expected exactly one late pinned-sidebar owner.");
  }
  const iifeStart = source.lastIndexOf("(() => {", sidebarOwner);
  const watchlistRouteStart = source.indexOf("  function routeViewFromPath() {", sidebarOwner);
  if (iifeStart < 0 || watchlistRouteStart < 0) {
    throw new Error("Could not isolate the sidebar/watchlist compatibility IIFE.");
  }
  source = source.slice(0, iifeStart) + "(() => {\n" + source.slice(watchlistRouteStart);

  const routeOwnerStart = source.indexOf("  function routeViewFromPath() {", iifeStart);
  const captureStart = source.indexOf('\n\n  document.addEventListener("click", (event) => {', routeOwnerStart);
  if (captureStart < 0) {
    throw new Error("Could not locate the obsolete sidebar capture owner.");
  }

  const setPageSidebarCall = source.lastIndexOf("keepSidebarExpanded();", captureStart);
  if (setPageSidebarCall < routeOwnerStart) {
    throw new Error("Could not isolate the setPage sidebar refresh call.");
  }
  source = source.slice(0, setPageSidebarCall) + source.slice(setPageSidebarCall + "keepSidebarExpanded();".length);

  const publicProgressionMarker = "\n})();\n\n/* Public progression table views */";
  const adjustedCaptureStart = source.indexOf('\n\n  document.addEventListener("click", (event) => {', routeOwnerStart);
  const iifeEnd = source.indexOf(publicProgressionMarker, adjustedCaptureStart);
  if (adjustedCaptureStart < 0 || iifeEnd < 0) {
    throw new Error("Could not remove the obsolete sidebar capture/DOMContentLoaded tail.");
  }
  source = source.slice(0, adjustedCaptureStart) + source.slice(iifeEnd);

  for (const stale of [
    "function keepSidebarExpanded()",
    "permanentlyExpandedMenu",
    "menuAnimationTimer",
    'classList.add("menuAnimating")',
    'classList.add("menuOpen")',
    '"sidebarClosed"',
    '"sidebarCollapsed"',
    "keepSidebarExpanded();",
    "menuButton.style.pointerEvents",
    "menuButton.style.cursor",
  ]) {
    if (source.includes(stale)) {
      throw new Error(`Stale sidebar owner remains after migration: ${stale}`);
    }
  }

  await writeFile(path, source, "utf8");
  console.log("Canonical pinned-sidebar source migration applied.");
}

function reportValidatedMigration() {
  if (!inMigrationCi) {
    console.log("Sidebar migration report skipped outside the dedicated GitHub Actions PR run.");
    return;
  }

  git(["diff", "--check"], { stdio: "inherit" });
  const patch = git(["diff", "--", "site/modules/app-core.js"]);
  if (!patch.includes("function updateMenuVisibility()") || !patch.includes("keepSidebarExpanded")) {
    throw new Error("Validated sidebar migration patch is incomplete.");
  }
  console.log("Validated canonical sidebar migration patch:\n" + patch);
}

if (mode === "apply") {
  await applyMigration();
} else if (mode === "publish") {
  reportValidatedMigration();
} else {
  throw new Error(`Unknown sidebar migration mode: ${mode || "<empty>"}`);
}
