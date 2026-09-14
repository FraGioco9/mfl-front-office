let pendingViewButtonPointer = null;
let pointerCommittedViewButton = null;
let pointerCommittedViewButtonTimer = 0;

function activateViewButton(button) {
  if (!(button instanceof HTMLButtonElement) || button.disabled || button.hidden) return;
  const pageName = pageNameForViewButton(button);
  const viewName = button.dataset.view;
  if (!viewName) return;

  const activePageName = state.currentPage === "mflstats" ? "mfl" : state.currentPage;
  const activeViewName = state.currentPage === "mflstats" ? "stats" : state.view;
  if (pageName === activePageName && viewName === activeViewName) return;

  if (pageName === activePageName && tablePages.has(pageName)) {
    saveTableStateLocally(currentTableState());
  }

  if (pageName === "mfl" && viewName === "stats") {
    void runViewTransition("mfl", "stats", { statePageName: "mflstats" }, async () => {
      await setPage("mfl", false, { view: "stats", skipNavigationTransition: true, skipNavigationLoading: true });
    });
    return;
  }
  if (state.currentPage === "mflstats" && pageName === "mfl" && viewName === "attributes") {
    void runViewTransition("mfl", "attributes", { statePageName: "mfl" }, async () => {
      await setPage("mfl", false, { view: "attributes", skipNavigationTransition: true, skipNavigationLoading: true });
    });
    return;
  }
  if (pageName === "database" && viewName === "stats") {
    void runViewTransition("database", "stats", {}, async () => {
      await setPage("database", false, { view: "stats", skipNavigationTransition: true, skipNavigationLoading: true });
    });
    return;
  }
  if (state.currentPage === "database"
      && state.view === "stats"
      && pageName === "database"
      && (viewName === "attributes" || viewName === "contracts")) {
    void runViewTransition("database", viewName, { statePageName: "database" }, async () => {
      await setPage("database", false, {
        view: viewName,
        skipNavigationTransition: true,
        skipNavigationLoading: true,
      });
    });
    return;
  }
  if (pageName !== state.currentPage && tablePages.has(pageName)) {
    state.currentPage = pageName;
    document.body.dataset.page = pageName;
  }
  const clubTarget = pageName === "club" ? clubRouteTargetFromPath() : null;
  if (pageName === "club" && !clubTarget?.clubId) return;
  const clubPath = clubTarget?.clubId
    ? window.__mflAppConfig?.routes?.clubPath?.(clubTarget.clubId, viewName) || ""
    : "";
  void runViewTransition(pageName, viewName, {
    walletAddress: state.currentAgentWalletAddress,
    watchlistId: state.currentWatchlistId,
    ...(clubTarget?.clubId ? {
      clubId: clubTarget.clubId,
      path: clubPath,
    } : {}),
  }, async () => {
    await setView(viewName);
  });
}

function clearPointerCommittedViewButton() {
  pointerCommittedViewButton = null;
  if (pointerCommittedViewButtonTimer) window.clearTimeout(pointerCommittedViewButtonTimer);
  pointerCommittedViewButtonTimer = 0;
}

function commitViewButtonOnPointerRelease(button, event) {
  const pending = pendingViewButtonPointer;
  pendingViewButtonPointer = null;
  if (!pending || pending.button !== button || pending.pointerId !== event.pointerId) return;
  if (event.isPrimary === false || event.button !== 0) return;

  // Commit on the button's own pointerup. This restores the real-pointer path
  // without bringing back the former document-wide table-loading interceptor,
  // synthetic popstate, or click swallowing that could freeze the site.
  pointerCommittedViewButton = button;
  if (pointerCommittedViewButtonTimer) window.clearTimeout(pointerCommittedViewButtonTimer);
  pointerCommittedViewButtonTimer = window.setTimeout(clearPointerCommittedViewButton, 0);
  activateViewButton(button);
}

viewButtons.forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    if (event.isPrimary === false || event.button !== 0 || button.disabled || button.hidden) {
      pendingViewButtonPointer = null;
      return;
    }
    pendingViewButtonPointer = { button, pointerId: event.pointerId };
  });
  button.addEventListener("pointerup", (event) => commitViewButtonOnPointerRelease(button, event));
  button.addEventListener("pointercancel", () => {
    if (pendingViewButtonPointer?.button === button) pendingViewButtonPointer = null;
  });
  button.addEventListener("click", (event) => {
    if (pointerCommittedViewButton === button) {
      // A normal mouse click follows pointerup in the same task. The view has
      // already been committed once, so suppress only the duplicate default
      // activation; keyboard-generated clicks still use this handler.
      event.preventDefault();
      clearPointerCommittedViewButton();
      return;
    }
    activateViewButton(button);
  });
});

watchlistButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  toggleWatchlistDropdown();
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openSearch();
  } else if (event.key === "Escape" && !searchModal.hidden) {
    event.preventDefault();
    if (document.activeElement instanceof HTMLElement && searchModal.contains(document.activeElement)) document.activeElement.blur();
  } else if (event.key === "Escape" && !filtersModal.hidden) {
    event.preventDefault();
    if (document.activeElement instanceof HTMLElement && filtersModal.contains(document.activeElement)) document.activeElement.blur();
  } else if (event.key === "Escape" && !watchlistChoiceModal?.hidden) {
    event.preventDefault();
    if (document.activeElement instanceof HTMLElement && watchlistChoiceModal.contains(document.activeElement)) document.activeElement.blur();
  } else if (event.key === "Escape" && !addWatchlistModal.hidden) {
    event.preventDefault();
    if (document.activeElement instanceof HTMLElement && addWatchlistModal.contains(document.activeElement)) document.activeElement.blur();
  } else if (event.key === "Escape" && !deleteWatchlistModal.hidden) {
    event.preventDefault();
    if (document.activeElement instanceof HTMLElement && deleteWatchlistModal.contains(document.activeElement)) document.activeElement.blur();
  } else if (event.key === "Escape" && !advancedSettingsModal.hidden) {
    event.preventDefault();
    if (document.activeElement instanceof HTMLElement && advancedSettingsModal.contains(document.activeElement)) document.activeElement.blur();
  } else if (event.key === "Escape" && !watchlistDropdown?.hidden) {
    closeWatchlistDropdown();
  } else if (event.key === "Escape" && !accountDropdown.hidden) {
    closeAccountMenu();
  } else if (event.key === "Enter" && !addWatchlistModal.hidden) {
    event.preventDefault();
    confirmAddWatchlist();
  } else if (event.key === "Enter" && !deleteWatchlistModal.hidden) {
    event.preventDefault();
    confirmDeleteWatchlist();
  } else if (event.key === "Enter" && !filtersModal.hidden) {
    event.preventDefault();
    applyAdvancedFilters();
  } else if (event.key === "Enter" && !advancedSettingsModal.hidden && [advancedMflUsdInput, advancedThirdLastRewardInput, advancedSecondLastRewardInput, advancedFinalRewardInput].includes(document.activeElement)) {
    event.preventDefault();
    applyAdvancedSettings();
  }
});

let accountPointerStartedOutside = false;
let watchlistPointerStartedOutside = false;
let suppressWatchlistDropdownCloseOnce = false;

document.addEventListener("pointerdown", (event) => {
  accountPointerStartedOutside = !accountMenu.contains(event.target);
  watchlistPointerStartedOutside = !watchlistSwitcher?.contains(event.target);
});

document.addEventListener("click", (event) => {
  if (accountPointerStartedOutside && !accountDropdown.hidden && !accountMenu.contains(event.target)) {
    closeAccountMenu();
  }

  const watchlistModalOpen = (addWatchlistModal && !addWatchlistModal.hidden) || (deleteWatchlistModal && !deleteWatchlistModal.hidden);
  if (suppressWatchlistDropdownCloseOnce) {
    suppressWatchlistDropdownCloseOnce = false;
  } else if (!watchlistModalOpen && watchlistPointerStartedOutside && watchlistDropdown && !watchlistDropdown.hidden && !watchlistSwitcher?.contains(event.target)) {
    closeWatchlistDropdown();
  }

  accountPointerStartedOutside = false;
  watchlistPointerStartedOutside = false;
});

setupBackdropClickClose(searchModal, closeSearch);

setupBackdropClickClose(watchlistChoiceModal, closeWatchlistChoiceModal);
setupBackdropClickClose(addWatchlistModal, closeAddWatchlistModal);
setupBackdropClickClose(deleteWatchlistModal, closeDeleteWatchlistModal);


discardAddWatchlistButton?.addEventListener("click", closeAddWatchlistModal);
closeAddWatchlistButton?.addEventListener("click", closeAddWatchlistModal);
confirmAddWatchlistButton?.addEventListener("click", confirmAddWatchlist);
cancelDeleteWatchlistButton?.addEventListener("click", closeDeleteWatchlistModal);
closeDeleteWatchlistButton?.addEventListener("click", closeDeleteWatchlistModal);
confirmDeleteWatchlistButton?.addEventListener("click", confirmDeleteWatchlist);
closeWatchlistChoiceButton?.addEventListener("click", closeWatchlistChoiceModal);
addWatchlistFromChoiceButton?.addEventListener("click", () => openAddWatchlistModal(state.pendingWatchlistChoiceAction === "move" ? "move-selected" : "add-selected"));
addWatchlistNameInput?.addEventListener("input", () => {
  if (addWatchlistError) {
    addWatchlistError.hidden = true;
    addWatchlistError.textContent = "";
  }
  addWatchlistNameInput.removeAttribute("aria-invalid");
  if (addWatchlistNameInput.value.length > 20) {
    addWatchlistNameInput.value = addWatchlistNameInput.value.slice(0, 20);
  }
});


themeButton.addEventListener("click", () => {
  const currentTheme = document.documentElement.dataset.theme || "light";
  applyTheme(currentTheme === "dark" ? "light" : "dark");
  queueThemePreferenceCloudSync();
});

menuButton.addEventListener("click", toggleMenu);
brandLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    setPage("home");
  });
});

document.querySelectorAll("a[data-page=\"changelog\"]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    setPage("changelog");
  });
});
openSearchButton.addEventListener("click", openSearch);
closeSearchButton.addEventListener("click", closeSearch);
playerSearchClearButton.addEventListener("click", clearPlayerSearch);
window.addEventListener("storage", syncRecentSearchStateFromStorage);
playerSearchInput.addEventListener("input", renderSearchResults);
const setPageWithoutRouteLoading = setPage;

navButtons.forEach((button) => {
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    const pageName = button.dataset.page;
    const reuseCachedEvaluationRoute = pageName === "evaluation" && evaluationPageCacheReady;
    const options = tablePages.has(pageName)
      ? { view: preferredViewForPage(pageName) }
      : pageName === "evaluation"
        ? { plain: true, reuseCachedRoute: reuseCachedEvaluationRoute }
        : {};
    const target = pagePath(pageName, options);
    if (button.classList.contains("active") && target === `${location.pathname}${location.search}`) return;
    if (pageName === "evaluation") preparePlainEvaluationReentry();
    if (reuseCachedEvaluationRoute) {
      await setPageWithoutRouteLoading(pageName, true, options);
      return;
    }
    await setPage(pageName, true, options);
  });
});


window.addEventListener("scroll", () => hidePlayerNoteTooltip({ immediate: true }), true);
window.addEventListener("resize", () => hidePlayerNoteTooltip({ immediate: true }));

window.addEventListener("popstate", () => {
  const target = pageTargetFromPath(`${window.location.pathname}${window.location.search}`);
  setPage(target.pageName, false, { ...target.options, preserveScroll: true });
});

accountButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleAccountMenu();
});
accountEmail.addEventListener("click", () => {
  if (!state.linkedWalletAddress || !hasWalletProof()) {
    return;
  }
  closeAccountMenu();
  setPage("myplayers");
});
linkWalletButton.addEventListener("click", linkWallet);
if (accountSettingsButton) {
  accountSettingsButton.addEventListener("click", () => {
    accountDropdown.hidden = true;
    accountButton.setAttribute("aria-expanded", "false");
    setPage("settings");
  });
}
if (homeOptInButton) {
  homeOptInButton.addEventListener("click", linkWallet);
}
if (myPlayersOptInButton) {
  myPlayersOptInButton.addEventListener("click", linkWallet);
}
