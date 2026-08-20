// @ts-check

import {
  replaceRequired,
  replaceRequiredFunction,
} from "./app-core-splitter-utils.js";

const PINNED_SIDEBAR_COMPATIBILITY_PREFIX = `(() => {
  const mflWalletAddress = "0xff8d2bbed8164db0";

  function keepSidebarExpanded() {
    if (typeof state === "object" && state) state.menuOpen = true;

    [document.body, typeof appShell !== "undefined" ? appShell : null, typeof sidebar !== "undefined" ? sidebar : null, typeof menuRail !== "undefined" ? menuRail : null]
      .filter(Boolean)
      .forEach((element) => {
        element.classList.remove("menuClosed", "sidebarClosed", "sidebarCollapsed", "collapsed");
        element.classList.add("menuOpen");
      });

    if (typeof menuButton !== "undefined" && menuButton) {
      menuButton.disabled = true;
      menuButton.tabIndex = -1;
      menuButton.setAttribute("aria-disabled", "true");
      menuButton.setAttribute("aria-expanded", "true");
      menuButton.style.pointerEvents = "none";
      menuButton.style.cursor = "default";
    }
  }

  if (typeof toggleMenu === "function") {
    toggleMenu = function permanentlyExpandedMenu() {
      keepSidebarExpanded();
    };
  }

  function routeViewFromPath() {`;

const PINNED_SIDEBAR_COMPATIBILITY_TAIL = `

  document.addEventListener("click", (event) => {
    if (typeof menuButton !== "undefined" && menuButton && (event.target === menuButton || menuButton.contains(event.target))) {
      event.preventDefault();
      event.stopImmediatePropagation();
      keepSidebarExpanded();
      return;
    }

  }, true);

  keepSidebarExpanded();
  document.addEventListener("DOMContentLoaded", () => {
    keepSidebarExpanded();
      }, { once: true });`;

export function normalizePinnedSidebarApplicationCoreRuntime(source) {
  let core = String(source || "").replace(/\r\n?/g, "\n");
  if (!core.trim()) {
    throw new Error("Cannot normalize pinned sidebar ownership in an empty application core.");
  }

  core = replaceRequired(
    core,
    "  menuAnimationTimer: null;\n".replace(";", ","),
    "",
    "obsolete sidebar animation state",
  );

  core = replaceRequiredFunction(
    core,
    "updateMenuVisibility",
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
    "canonical pinned-sidebar visibility",
  );

  core = replaceRequiredFunction(
    core,
    "toggleMenu",
    `function toggleMenu() {
  updateMenuVisibility();
}`,
    "non-interactive pinned-sidebar toggle",
  );

  core = replaceRequiredFunction(
    core,
    "restoreMenuState",
    `function restoreMenuState() {
  state.menuOpen = true;
}`,
    "pinned-sidebar persisted state",
  );

  core = replaceRequired(
    core,
    PINNED_SIDEBAR_COMPATIBILITY_PREFIX,
    `(() => {
  function routeViewFromPath() {`,
    "legacy pinned-sidebar compatibility prefix",
  );
  core = replaceRequired(
    core,
    "      keepSidebarExpanded();\n",
    "",
    "legacy setPage sidebar refresh",
  );
  core = replaceRequired(
    core,
    PINNED_SIDEBAR_COMPATIBILITY_TAIL,
    "",
    "legacy pinned-sidebar capture and DOM-ready ownership",
  );

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
    if (core.includes(staleOwner)) {
      throw new Error(`Legacy pinned-sidebar runtime ownership remains after normalization: ${staleOwner}`);
    }
  }

  return core;
}
