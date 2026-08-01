(() => {
  const VERSION = "1.119.12";
  const SOURCE_COMMIT = "dc3265ceb18ee501e6107f3a31869c6500738e92";
  const SOURCE_URL = `https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@${SOURCE_COMMIT}/site/app.js`;
  const START_MARKER = "async function startApp() {";
  const END_MARKER = "\n(() => {\n  const currentVersion";
  const RELEASES = [
    ["v1.119.12", "Show the current footer version and complete Changelog on first paint"],
    ["v1.119.11", "Render Changelog before summary and account startup"],
    ["v1.119.10", "Finish the data-free Changelog boot and round the loading placeholder row"],
    ["v1.119.9", "Round the rendered loading table bottom and show Changelog immediately on refresh"],
    ["v1.119.8", "Keep the last rendered table row rounded while loading"],
    ["v1.119.7", "Complete Changelog history, disable the current-page footer link, and keep loading table bottoms square"],
    ["v1.119.6", "Reveal rows as soon as data renders, keep loading headers square, and restore the native Changelog link"],
    ["v1.119.5", "Keep the footer stable, restore Changelog navigation, and square loading table bottoms"],
    ["v1.119.4", "Prevent stale table rows and keep footer navigation stable"],
    ["v1.119.3", "Keep table header bottom corners square while loading"],
    ["v1.119.2", "Show a stable footer version immediately after loading"],
    ["v1.119.1", "Restore the Changelog footer link and synchronize the displayed version"],
    ["v1.119.0", "Optimize paged data loading, cache responses, and link player contract clubs"],
    ["v1.118.33", "Preserve native MFL Stats filters, keep the loading cursor, and link player contract teams"],
    ["v1.118.32", "Make player contract teams native links and restore MFL Stats filter clicks"],
    ["v1.118.31", "Remove the legacy Evaluation rate, stabilize Stats filters, and link player contracts"],
    ["v1.118.30", "Remove the legacy Evaluation rate, link player contracts, and restore MFL Stats controls"],
    ["v1.118.29", "Restore native MFL Stats filter interactions after loading"],
    ["v1.118.28", "Prevent Evaluation refresh stalls and require Supabase for the Discount Rate"],
    ["v1.118.27", "Restore immediate Home startup while keeping Evaluation and MFL Stats fixes route-scoped"],
    ["v1.118.26", "Prevent Evaluation value flashes, synchronize the Load action, and stabilize MFL Stats controls"],
    ["v1.118.25", "Link contract teams, reveal the Evaluation Load action early, and restore Stats filter clicks"],
    ["v1.118.24", "Prevent Home boot stalls and keep route fixes scoped to their pages"],
    ["v1.118.23", "Prevent false player-not-found flashes, link contract teams, and reveal the Evaluation shell immediately"],
    ["v1.118.22", "Keep player routes loading, link teams, restore Stats controls, and reveal the Evaluation shell"],
    ["v1.118.21", "Fix tooltip placement, player team links, Stats loading controls, and the Evaluation loading shell"],
    ["v1.118.20", "Keep tooltips clear of the header, link player teams, restore Stats filters, and reveal Evaluation together"],
    ["v1.118.19", "Reset Evaluation routes, link player teams, align loading UI, and restore MFL Stats filters"],
    ["v1.118.18", "Remove loading header rounding, prevent Evaluation flashes, and restore MFL Stats filters"],
    ["v1.118.17", "Restore Evaluation metric formatting, hide Load on player routes, and enable MFL Stats filters"],
    ["v1.118.16", "Synchronize the Evaluation discount-rate display with the active calculation"],
    ["v1.118.15", "Preserve Evaluation player and share routes and restore Stats filters"],
    ["v1.118.14", "Keep the Evaluation search inactive when a player is selected"],
    ["v1.118.13", "Allow opted-out evaluation shares, restore Stats filters, and focus empty Evaluation search"],
    ["v1.118.12", "Animate the discount tooltip, restore Stats filters, and support local season ratios"],
    ["v1.118.11", "Fix Evaluation tooltip placement, Stats filters, and Season 16 discount history"],
    ["v1.118.10", "Fix Evaluation tooltip, Stats interactions, footer timing, and season ratios"],
    ["v1.118.9", "Restore MFL Stats interactions after loading"],
    ["v1.118.8", "Complete SemVer changelog history and keep the latest version current"],
    ["v1.118.7", "Enforce API limits, lock loading views, and rebuild version history"],
    ["v1.118.6", "Show the content-area scrollbar from the first page render"],
    ["v1.118.5", "Extend the global shell to the right edge and keep version UI current"],
    ["v1.118.4", "Keep page scrollbars between the header and footer and sync the latest version"],
    ["v1.118.3", "Layer Evaluation search results above page content"],
    ["v1.118.2", "Fix Evaluation tooltip and empty height; cap MFL API at 50/min"],
    ["v1.118.1", "Keep the Evaluation header sticky and focus empty player search"],
    ["v1.118.0", "Use Supabase season ratios for Evaluation discount rates"],
    ["v1.117.6", "Keep Search, Advanced Settings, and Saved Evaluations above page content"],
    ["v1.117.5", "Keep Search and Advanced Settings above page content"],
    ["v1.117.4", "Extend the empty Evaluation page to the footer"],
    ["v1.117.3", "Layer Evaluation search results above page content without changing overflow"],
    ["v1.117.2", "Keep Evaluation search results above page content"],
  ];

  const replacement = `async function startApp() {
  loadTheme();
  setupChangelogSections();
  const initialTarget = pageTargetFromPath(\`\${window.location.pathname}\${window.location.search}\`);
  const initialPage = initialTarget.pageName;
  loadSavedTableState();
  loadEvaluationMflPerUsd();
  loadEvaluationLateSeasonRewardRates();
  renderEvaluationMflPerUsdControl(false);
  evaluationDiscountRate.textContent = formatEvaluationRate(evaluationDiscountRateValue());
  updateMenuVisibility();

  loadingScreen.hidden = true;
  document.documentElement.classList.remove("loading", "table-layout-pending");
  document.body.classList.remove("booting", "loading", "tableLayoutPending");
  revealAppShell();
  showAppShell();

  if (initialPage === "changelog") {
    applyStoredWalletPermission();
    updateAccountState();
    await showHomeShell("changelog", false, initialTarget.options);
    return;
  }

  beginInteractionBusy();

  try {
    void ensureFlowWallet();
    applyStoredWalletPermission();
    await loadSummary();
    await loadWalletPreferences();
    updateAccountState();
    await showHomeShell(initialPage, false, initialTarget.options);
  } finally {
    endInteractionBusy({ reset: true });
  }
}`;

  function syncFooterVersion() {
    const root = document.documentElement;
    root.classList.add("mflRelease112Ready");
    root.dataset.mflReleaseVersion = VERSION;

    const footer = document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
    if (!footer) return false;

    const label = `MFL Front Office v${VERSION}`;
    if (footer.textContent !== label) footer.textContent = label;
    if (footer.getAttribute("href") !== "/changelog") footer.setAttribute("href", "/changelog");
    if (footer.dataset.releaseLabel !== label) footer.dataset.releaseLabel = label;
    const ariaLabel = `${label}, open Changelog`;
    if (footer.getAttribute("aria-label") !== ariaLabel) footer.setAttribute("aria-label", ariaLabel);
    return true;
  }

  function preloadReleaseEntries() {
    const list = document.querySelector(".changelogList");
    if (!list || list.querySelector(".changelogMinorSection")) return false;

    const existing = new Set(
      Array.from(list.querySelectorAll(":scope > li > span"))
        .map((label) => String(label.textContent || "").trim()),
    );
    const fragment = document.createDocumentFragment();

    RELEASES.forEach(([label, description]) => {
      if (existing.has(label)) return;
      const item = document.createElement("li");
      const version = document.createElement("span");
      const text = document.createElement("p");
      version.textContent = label;
      text.textContent = description;
      item.append(version, text);
      fragment.appendChild(item);
      existing.add(label);
    });

    if (fragment.childNodes.length) list.prepend(fragment);
    list.dataset.completeReleaseVersion = VERSION;
    return true;
  }

  function fail(message) {
    console.error(message);
    document.documentElement.classList.remove("bootPending", "loading", "appBusy", "table-layout-pending");
    document.body?.classList.remove("booting", "loading", "appBusy", "tableLayoutPending");
    const loadingScreen = document.getElementById("loadingScreen");
    if (loadingScreen) loadingScreen.hidden = true;
    const main = document.querySelector("main");
    if (main) main.innerHTML = '<p class="emptyState">Could not load MFL Front Office.</p>';
  }

  syncFooterVersion();
  preloadReleaseEntries();

  const footerObserver = new MutationObserver(() => syncFooterVersion());
  footerObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "href", "data-page", "data-mfl-release-version"],
    childList: true,
    characterData: true,
    subtree: true,
  });

  try {
    const request = new XMLHttpRequest();
    request.open("GET", SOURCE_URL, false);
    request.send(null);

    if (!(request.status >= 200 && request.status < 300) || !request.responseText) {
      fail(`Could not load the pinned application source (${request.status}).`);
      return;
    }

    const source = request.responseText;
    const startIndex = source.indexOf(START_MARKER);
    const endIndex = source.indexOf(END_MARKER, startIndex);
    if (startIndex < 0 || endIndex < 0) {
      fail("Could not locate the application startup function.");
      return;
    }

    let patchedSource = `${source.slice(0, startIndex)}${replacement}${source.slice(endIndex)}`;
    patchedSource = patchedSource.replace(
      /const currentVersion = "\d+\.\d+\.\d+";/g,
      `const currentVersion = "${VERSION}";`,
    );
    patchedSource += `\n//# sourceURL=mfl-front-office-app-v${VERSION}.js`;

    const script = document.createElement("script");
    script.textContent = patchedSource;
    document.head.appendChild(script);
    syncFooterVersion();
  } catch (error) {
    fail(error?.message || "Could not initialize the application.");
  }
})();
