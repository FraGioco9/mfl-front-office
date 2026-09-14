function setupChangelogSections() {
  const list = document.querySelector(".changelogList");
  if (!list || list.dataset.sectioned === "true") {
    return;
  }

  const items = Array.from(list.querySelectorAll(":scope > li"));
  if (!items.length) {
    return;
  }

  const groupedItems = [];
  const groupsByMinor = new Map();

  items.forEach((item) => {
    const versionText = item.querySelector("span")?.textContent?.trim() || "Version";
    const versionMatch = versionText.match(/^v(\d+)\.(\d+)(?:\.|$)/i);
    const minorVersion = versionMatch ? `v${versionMatch[1]}.${versionMatch[2]}` : versionText;
    let group = groupsByMinor.get(minorVersion);
    if (!group) {
      group = { minorVersion, items: [] };
      groupsByMinor.set(minorVersion, group);
      groupedItems.push(group);
    }
    group.items.push(item);
  });

  list.textContent = "";
  list.dataset.sectioned = "true";

  groupedItems.forEach((group, index) => {
    const section = document.createElement("li");
    section.className = "changelogMinorSection";

    const toggle = document.createElement("button");
    toggle.className = "changelogMinorToggle";
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", index === 0 ? "true" : "false");

    const title = document.createElement("span");
    title.className = "changelogMinorVersion";
    title.textContent = group.minorVersion;

    const meta = document.createElement("span");
    meta.className = "changelogMinorMeta";
    meta.textContent = `${group.items.length} ${group.items.length === 1 ? "patch" : "patches"}`;

    const chevron = document.createElement("span");
    chevron.className = "changelogMinorChevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = ">";

    toggle.append(title, meta, chevron);

    const panel = document.createElement("div");
    panel.className = "changelogMinorPanel";

    const panelInner = document.createElement("div");
    panelInner.className = "changelogMinorPanelInner";

    const patchList = document.createElement("ol");
    patchList.className = "changelogPatchList";
    group.items.forEach((item) => patchList.appendChild(item));
    panelInner.appendChild(patchList);
    panel.appendChild(panelInner);

    if (index === 0) {
      section.classList.add("is-expanded");
    }

    toggle.addEventListener("click", () => {
      const isExpanded = section.classList.toggle("is-expanded");
      toggle.setAttribute("aria-expanded", isExpanded ? "true" : "false");
    });

    section.append(toggle, panel);
    list.appendChild(section);
  });
}

async function startApp() {
  loadTheme();
  setupChangelogSections();
  loadSavedTableState();
  window.__mflCoreContracts?.installEvaluationRecentStateOwnership?.();
  const initialTarget = pageTargetFromPath(`${location.pathname}${location.search}`);
  commitPageTransition(initialTarget.pageName, false, initialTarget.options);
  const startupNavigationSequence = navigationTransitionSequence;
  const startupSummaryPromise = loadSummary();
  const startupWalletPreferencesPromise = loadWalletPreferences();
  window.__mflWalletPreferencesStartupPromise = Promise.resolve(startupWalletPreferencesPromise);
  Reflect.set(window, "__mflSettingsStartupWalletPreferencesPending", initialTarget.pageName === "settings");
  const startupProgressionPermissionPromise = (
    pageRequiresProgressionPermission(initialTarget.pageName)
    && hasWalletOptIn()
  )
    ? loadWalletPermissions({ force: true })
    : null;
  applyStoredWalletPermission();
  loadEvaluationMflPerUsd();
  loadEvaluationLateSeasonRewardRates();
  updateMenuVisibility();
  showAppShell();

  const startupDependencies = [];
  if (startupProgressionPermissionPromise) startupDependencies.push(startupProgressionPermissionPromise);
  if (initialTarget.pageName === "home") startupDependencies.push(startupSummaryPromise);
  if (["watchlist", "myplayers", "settings", "player", "evaluation"].includes(initialTarget.pageName)) {
    startupDependencies.push(startupWalletPreferencesPromise);
  }
  await Promise.allSettled(startupDependencies);
  applyStoredWalletPermission();
  updateAccountState();
  updateMenuVisibility();

  const initialRouteRuntimeReadyPromise = Reflect.get(window, "__mflInitialRouteRuntimeReadyPromise");
  if (!initialRouteRuntimeReadyPromise || typeof initialRouteRuntimeReadyPromise.then !== "function") {
    throw new Error("Initial route runtime readiness gate is unavailable.");
  }
  await initialRouteRuntimeReadyPromise;

  if (navigationTransitionSequence === startupNavigationSequence) {
    const authoritativeTarget = pageTargetFromPath(`${location.pathname}${location.search}`);
    await showHomeShell(authoritativeTarget.pageName, false, authoritativeTarget.options);
  }

  void Promise.allSettled([startupSummaryPromise, startupWalletPreferencesPromise]).then(() => {
    applyStoredWalletPermission();
    updateAccountState();
  });
}
