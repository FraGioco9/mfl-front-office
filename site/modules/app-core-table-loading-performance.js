// @ts-check

import { replaceRequiredFunction } from "./app-core-splitter-utils.js";

const OPTIMIZED_TABLE_LOADING_SHELL = `function renderTableLoadingShell(pageName) {
  state.currentPage = pageName;
  const tablePage = tablePages.has(pageName);

  if (!tablePage) {
    return;
  }

  const setChecked = (input, checked) => {
    if (input && input.checked !== checked) input.checked = checked;
  };
  const setHidden = (element, hidden) => {
    if (element && element.hidden !== hidden) element.hidden = hidden;
  };

  const clubPage = pageName === "club";
  if (clubPage) {
    state.pendingTableControlRestore = null;
    if (filterRules.childNodes.length) filterRules.replaceChildren();
    setChecked(hideRetiredInput, false);
    setChecked(hideRetiringInput, false);
    setChecked(hideMflPlayersInput, false);
    setChecked(packablePlayersInput, false);
    setChecked(newMintsInput, false);
    setHidden(document.querySelector("#progressionPage .quickFilters"), true);
    setHidden(document.querySelector("#progressionPage .controlsBar"), true);
    document.querySelectorAll("#progressionPage .pager, #progressionPage nav.pager").forEach((pager) => {
      setHidden(pager, true);
    });
  } else {
    restoreSavedTableState(pageName);
    globalThis.syncQuickFilterLabels?.();
  }

  updateViewButtons();
  if (pageName === "agents") {
    renderAgentPageTitle(state.currentAgentWalletAddress || agentWalletAddressFromUrl());
  } else if (pageName !== "club") {
    const title = tableTitleForPage(pageName);
    if (tablePageTitle.textContent !== title) tablePageTitle.textContent = title;
  }
  setHidden(emptyState, true);
  if (emptyState.textContent) emptyState.textContent = "";

  // Hand replacement ownership directly to Uniform Loading. This preserves the
  // same loading rows while avoiding the former empty-body replace followed by
  // a second replace when the loading rows were primed.
  const loadingShown = window.__mflTableLoadingRuntime?.show?.({ replaceExisting: true, forceRoute: true });
  if (!loadingShown) tableBody.replaceChildren();
}`;

export function optimizeTableLoadingRuntimeArtifacts(artifacts) {
  const input = artifacts && typeof artifacts === "object" ? artifacts : {};
  const routeChunks = { ...(input.routeChunks || {}) };
  let table = String(routeChunks.table || "");
  if (!table) throw new Error("Cannot optimize Table loading DOM work without the Table route chunk.");

  table = replaceRequiredFunction(
    table,
    "renderTableLoadingShell",
    OPTIMIZED_TABLE_LOADING_SHELL,
    "single-replacement Table loading shell",
  );

  routeChunks.table = table;
  return Object.freeze({
    ...input,
    routeChunks: Object.freeze(routeChunks),
  });
}
