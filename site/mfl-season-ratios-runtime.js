(() => {
  const VERSION = "1.118.39";
  const LEGACY_RUNTIME = "https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@515be7576f3be7232430a68f0a08019fe7aa7f67/site/mfl-season-ratios-runtime.js";
  const RELEASE_DESCRIPTION = "Keep the app shell visible when opening Contract teams";
  const CLUB_ID_COLUMNS = ["active_contract_club_id", "club_id", "current_club_id", "active_club_id"];
  const pendingPlayerRequests = new Set();
  const completedPlayerRequests = new Set();
  const pendingClubResolutions = new Map();

  let playerRouteId = "";
  let playerRouteStartedAt = 0;
  let requestHookInstalled = false;
  let renderHookInstalled = false;
  let bootstrapClubsPromise = null;
  let scheduled = false;

  function installStyles() {
    let style = document.getElementById("mflPlayerRouteFixStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "mflPlayerRouteFixStyles";
      document.head.appendChild(style);
    }
    style.textContent = `
      .siteFooter a[data-page="changelog"] { font-size: 0 !important; }
      .siteFooter a[data-page="changelog"]::before {
        content: "MFL Front Office v${VERSION}" !important;
        font-size: 14px !important;
      }
      body[data-page="player"].playerRouteLoading #playerDetail {
        position: relative;
        min-height: 72px;
      }
      body[data-page="player"].playerRouteLoading #playerDetail > .emptyState {
        visibility: hidden !important;
      }
      body[data-page="player"].playerRouteLoading #playerDetail::after {
        content: "Loading player...";
        display: block;
        padding: 24px;
        text-align: center;
        color: var(--text-muted, var(--muted, currentColor));
      }
      #playerDetail .contractDetailCard .playerContractTeamLink {
        font: inherit !important;
        font-size: 16px !important;
        font-weight: inherit !important;
        text-decoration: none !important;
        cursor: pointer !important;
        pointer-events: auto !important;
        transition: color 120ms ease !important;
      }
      #playerDetail .contractDetailCard .playerContractTeamLink:not(:hover):not(:focus-visible) {
        color: #e8eef3 !important;
      }
      #playerDetail .contractDetailCard .playerContractTeamLink:hover,
      #playerDetail .contractDetailCard .playerContractTeamLink:focus-visible {
        color: var(--primary) !important;
        text-decoration: none !important;
      }
    `;
  }

  function semver(value) {
    const match = String(value || "").match(/^v?(\d+)\.(\d+)\.(\d+)$/);
    return match ? match.slice(1).map(Number) : null;
  }

  function syncVersionUi() {
    const footer = document.querySelector('.siteFooter a[data-page="changelog"]');
    if (footer && footer.textContent !== `MFL Front Office v${VERSION}`) {
      footer.textContent = `MFL Front Office v${VERSION}`;
    }

    const list = document.querySelector(".changelogList");
    if (!list || list.dataset.playerRuntimeVersion === VERSION) return;
    const entries = new Map([[`v${VERSION}`, RELEASE_DESCRIPTION]]);
    list.querySelectorAll(".changelogPatchList li, .changelogList > li:not(.changelogMinorSection)").forEach((item) => {
      const label = String(item.querySelector(":scope > span")?.textContent || "").trim();
      if (semver(label) && !entries.has(label)) {
        entries.set(label, String(item.querySelector(":scope > p")?.textContent || "").trim());
      }
    });

    const groups = new Map();
    entries.forEach((description, label) => {
      const parts = semver(label);
      const key = `${parts[0]}.${parts[1]}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ label, description, patch: parts[2] });
    });

    list.replaceChildren();
    [...groups.entries()]
      .sort(([a], [b]) => {
        const x = a.split(".").map(Number);
        const y = b.split(".").map(Number);
        return y[0] - x[0] || y[1] - x[1];
      })
      .forEach(([minor, patches], index) => {
        patches.sort((a, b) => b.patch - a.patch);
        const section = document.createElement("li");
        section.className = "changelogMinorSection";
        if (!index) section.classList.add("is-expanded");
        const toggle = document.createElement("button");
        toggle.className = "changelogMinorToggle";
        toggle.type = "button";
        toggle.setAttribute("aria-expanded", !index ? "true" : "false");
        toggle.innerHTML = `<span class="changelogMinorVersion">v${minor}</span><span class="changelogMinorMeta">${patches.length} ${patches.length === 1 ? "patch" : "patches"}</span><span class="changelogMinorChevron" aria-hidden="true">&gt;</span>`;
        const panel = document.createElement("div");
        panel.className = "changelogMinorPanel";
        const inner = document.createElement("div");
        inner.className = "changelogMinorPanelInner";
        const patchList = document.createElement("ol");
        patchList.className = "changelogPatchList";
        patches.forEach(({ label, description }) => {
          const item = document.createElement("li");
          const version = document.createElement("span");
          const text = document.createElement("p");
          version.textContent = label;
          text.textContent = description;
          item.append(version, text);
          patchList.appendChild(item);
        });
        inner.appendChild(patchList);
        panel.appendChild(inner);
        section.append(toggle, panel);
        toggle.addEventListener("click", () => {
          const expanded = section.classList.toggle("is-expanded");
          toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
        });
        list.appendChild(section);
      });
    list.dataset.playerRuntimeVersion = VERSION;
  }

  function cleanPath() {
    return String(location.pathname || "/").replace(/\/+$/, "") || "/";
  }

  function currentPlayerId() {
    const match = cleanPath().match(/^\/players?\/([^/]+)$/i);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function rowForPlayer(playerId) {
    const id = String(playerId || "").trim();
    if (!id) return null;
    try {
      if (typeof rowByPlayerId === "function") return rowByPlayerId(id);
      if (typeof state === "object" && Array.isArray(state?.rows) && Array.isArray(state?.columns)) {
        const index = state.columns.indexOf("player_id");
        return index >= 0 ? state.rows.find((row) => String(row[index]) === id) : null;
      }
    } catch {
      return null;
    }
    return null;
  }

  function appBusy() {
    try {
      if (typeof state === "object" && state) {
        if (state.incrementalApplying || state.interactionBusyDepth > 0 || state.dataLoadPromise) return true;
        if (state.incrementalRequestPromises instanceof Map && state.incrementalRequestPromises.size > 0) return true;
      }
    } catch {
      // DOM state remains available.
    }
    return document.documentElement.classList.contains("bootPending")
      || document.documentElement.classList.contains("appBusy")
      || document.body.classList.contains("booting")
      || document.body.classList.contains("loading")
      || document.body.classList.contains("appBusy")
      || document.body.classList.contains("tableRowsLoading");
  }

  function playerStillLoading(playerId) {
    const id = String(playerId || "").trim();
    if (!id || rowForPlayer(id)) return false;
    if (pendingPlayerRequests.has(id)) return true;
    if (completedPlayerRequests.has(id)) return false;
    if (appBusy()) return true;
    return id === playerRouteId && Date.now() - playerRouteStartedAt < 3500;
  }

  function markLoading() {
    document.body.classList.add("playerRouteLoading");
    document.body.classList.remove("playerRouteSettled", "playerRouteGuardReady");
    const detail = document.getElementById("playerDetail");
    if (!detail) return;
    const text = String(detail.textContent || "").trim();
    if (!detail.children.length || /not found|loading player/i.test(text)) {
      detail.innerHTML = '<div class="emptyState">Loading player...</div>';
    }
  }

  function markSettled() {
    document.body.classList.remove("playerRouteLoading");
    document.body.classList.add("playerRouteSettled", "playerRouteGuardReady");
  }

  function installRequestHook() {
    if (requestHookInstalled || typeof requestIncrementalRoute !== "function") return;
    const originalRequest = requestIncrementalRoute;
    requestIncrementalRoute = async function trackedPlayerRequest(route) {
      const playerId = String(route?.scope === "player" ? route.playerId || currentPlayerId() : "").trim();
      if (playerId) {
        pendingPlayerRequests.add(playerId);
        completedPlayerRequests.delete(playerId);
        playerRouteId = playerId;
        playerRouteStartedAt = Date.now();
        markLoading();
      }
      try {
        return await originalRequest.apply(this, arguments);
      } finally {
        if (playerId) {
          pendingPlayerRequests.delete(playerId);
          completedPlayerRequests.add(playerId);
          schedule();
        }
      }
    };
    requestIncrementalRoute.__mflPlayerRequestGuard = true;
    requestHookInstalled = true;
  }

  function installRenderHook() {
    if (renderHookInstalled || typeof renderPlayerPage !== "function") return;
    const originalRender = renderPlayerPage;
    renderPlayerPage = function guardedPlayerRender(playerId) {
      const id = String(playerId || currentPlayerId() || "").trim();
      if (id && !rowForPlayer(id) && playerStillLoading(id)) {
        markLoading();
        return undefined;
      }
      const result = originalRender.apply(this, arguments);
      queueMicrotask(syncPlayerRoute);
      requestAnimationFrame(syncPlayerRoute);
      return result;
    };
    renderPlayerPage.__mflPlayerLifecycleGuard = true;
    renderHookInstalled = true;
  }

  function clubIdFromRow(row) {
    if (!row) return "";
    try {
      if (typeof getValue === "function") {
        for (const column of CLUB_ID_COLUMNS) {
          const value = String(getValue(row, column) || "").trim();
          if (value) return value;
        }
      }
      if (typeof state === "object" && Array.isArray(state?.columns)) {
        for (const column of CLUB_ID_COLUMNS) {
          const index = state.columns.indexOf(column);
          const value = index >= 0 ? String(row[index] || "").trim() : "";
          if (value) return value;
        }
      }
    } catch {
      return "";
    }
    return "";
  }

  function clubIdFromIndexes(teamName) {
    const normalized = String(teamName || "").trim().toLowerCase();
    if (!normalized) return "";
    try {
      const clubs = [
        ...(Array.isArray(state?.clubSearchIndex) ? state.clubSearchIndex : []),
        ...(Array.isArray(state?.bootstrapData?.clubs) ? state.bootstrapData.clubs : []),
      ];
      const match = clubs.find((club) => String(club?.name || "").trim().toLowerCase() === normalized);
      return String(match?.clubId || "").trim();
    } catch {
      return "";
    }
  }

  function loadBootstrapClubs() {
    if (bootstrapClubsPromise) return bootstrapClubsPromise;
    bootstrapClubsPromise = new Promise((resolve) => {
      const request = new XMLHttpRequest();
      request.open("GET", `/api/data?mode=bootstrap&v=${encodeURIComponent(VERSION)}`, true);
      request.timeout = 6000;
      request.onload = () => {
        try {
          const value = JSON.parse(request.responseText || "{}");
          resolve(Array.isArray(value?.clubs) ? value.clubs : []);
        } catch {
          resolve([]);
        }
      };
      request.onerror = () => resolve([]);
      request.ontimeout = () => resolve([]);
      request.send(null);
    }).finally(() => {
      bootstrapClubsPromise = null;
    });
    return bootstrapClubsPromise;
  }

  async function resolveClubId(teamName, playerId) {
    const rowId = clubIdFromRow(rowForPlayer(playerId));
    if (rowId) return rowId;
    const indexedId = clubIdFromIndexes(teamName);
    if (indexedId) return indexedId;
    const clubs = await loadBootstrapClubs();
    const normalized = String(teamName || "").trim().toLowerCase();
    const match = clubs.find((club) => String(club?.name || "").trim().toLowerCase() === normalized);
    return String(match?.clubId || "").trim();
  }

  function replaceTeamWithLink(team, playerId, teamName, clubId) {
    if (!clubId || !team?.isConnected) return false;
    const href = `/clubs/${encodeURIComponent(clubId)}/attributes`;
    if (team instanceof HTMLAnchorElement) {
      team.className = "agentTableLink playerAgentLink playerContractTeam playerContractTeamLink clubPageLink";
      team.dataset.playerContractVersion = VERSION;
      team.dataset.playerId = playerId;
      team.dataset.teamName = teamName;
      team.dataset.clubId = clubId;
      team.href = href;
      return true;
    }

    const link = document.createElement("a");
    link.className = "agentTableLink playerAgentLink playerContractTeam playerContractTeamLink clubPageLink";
    link.textContent = teamName;
    link.dataset.playerContractVersion = VERSION;
    link.dataset.playerId = playerId;
    link.dataset.teamName = teamName;
    link.dataset.clubId = clubId;
    link.href = href;
    team.replaceWith(link);
    return true;
  }

  function makeContractLink() {
    const playerId = currentPlayerId();
    const row = rowForPlayer(playerId);
    if (!playerId || !row) return false;
    const team = document.querySelector("#playerDetail .contractDetailCard .playerContractTeam, #playerDetail .contractDetailCard .playerContractTeamLink");
    if (!team) return false;
    const teamName = String(team.textContent || "").trim();
    if (!teamName || /^(free agent|development center)$/i.test(teamName)) return false;

    const immediateClubId = clubIdFromRow(row) || clubIdFromIndexes(teamName);
    if (immediateClubId) return replaceTeamWithLink(team, playerId, teamName, immediateClubId);

    const key = `${playerId}:${teamName.toLowerCase()}`;
    if (!pendingClubResolutions.has(key)) {
      const resolution = resolveClubId(teamName, playerId)
        .then((clubId) => {
          if (!clubId || currentPlayerId() !== playerId) return false;
          const currentTeam = document.querySelector("#playerDetail .contractDetailCard .playerContractTeam, #playerDetail .contractDetailCard .playerContractTeamLink");
          if (!currentTeam || String(currentTeam.textContent || "").trim() !== teamName) return false;
          return replaceTeamWithLink(currentTeam, playerId, teamName, clubId);
        })
        .finally(() => pendingClubResolutions.delete(key));
      pendingClubResolutions.set(key, resolution);
    }
    return false;
  }

  function releaseBusyBlocker() {
    try {
      if (typeof state === "object" && state && state.interactionBusyDepth > 0) {
        state.interactionBusyDepth = 0;
        if (typeof syncInteractionBusyState === "function") syncInteractionBusyState();
      }
    } catch {
      // In-app navigation remains authoritative.
    }
  }

  function contractLinkFromEvent(event) {
    const target = event.target instanceof Element ? event.target : null;
    return target?.closest("#playerDetail .contractDetailCard .playerContractTeamLink") || null;
  }

  function navigateContractClub(link) {
    const href = String(link?.getAttribute("href") || "").trim();
    if (!href || href === "#") return false;
    let target;
    try {
      target = new URL(href, window.location.href);
    } catch {
      return false;
    }
    if (target.origin !== window.location.origin) return false;
    const route = `${target.pathname}${target.search}`;
    if (`${window.location.pathname}${window.location.search}` !== route) {
      window.history.pushState({}, "", route);
    }
    window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
    return true;
  }

  window.addEventListener("pointerdown", (event) => {
    if (contractLinkFromEvent(event)) releaseBusyBlocker();
  }, true);

  window.addEventListener("click", (event) => {
    const link = contractLinkFromEvent(event);
    if (!link) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button === 1) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    releaseBusyBlocker();
    navigateContractClub(link);
  }, true);

  function syncPlayerRoute() {
    const playerId = currentPlayerId();
    if (!playerId) {
      playerRouteId = "";
      playerRouteStartedAt = 0;
      document.body.classList.remove("playerRouteLoading", "playerRouteSettled", "playerRouteGuardReady");
      return;
    }
    if (playerRouteId !== playerId) {
      playerRouteId = playerId;
      playerRouteStartedAt = Date.now();
      completedPlayerRequests.delete(playerId);
    }

    const row = rowForPlayer(playerId);
    if (row) {
      markSettled();
      const detail = document.getElementById("playerDetail");
      const text = String(detail?.textContent || "").trim();
      if (detail && (!detail.querySelector(".playerHero") || /not found|loading player/i.test(text))
          && typeof renderPlayerPage === "function") {
        renderPlayerPage(playerId);
      }
      makeContractLink();
      return;
    }

    if (playerStillLoading(playerId)) {
      markLoading();
      return;
    }

    markSettled();
    const detail = document.getElementById("playerDetail");
    if (detail && /loading player/i.test(String(detail.textContent || "")) && typeof renderPlayerPage === "function") {
      renderPlayerPage(playerId);
    }
  }

  function maintain() {
    installStyles();
    syncVersionUi();
    installRequestHook();
    installRenderHook();
    syncPlayerRoute();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      maintain();
    });
  }

  function startPatch() {
    maintain();
    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-page", "hidden", "inert", "aria-busy"],
      childList: true,
      subtree: true,
    });
    ["popstate", "hashchange"].forEach((name) => window.addEventListener(name, schedule));
    [0, 50, 150, 400, 1000, 2000, 3500, 6000].forEach((delay) => setTimeout(maintain, delay));
  }

  installStyles();
  const legacy = document.createElement("script");
  legacy.src = LEGACY_RUNTIME;
  legacy.async = false;
  legacy.addEventListener("load", startPatch, { once: true });
  legacy.addEventListener("error", startPatch, { once: true });
  document.head.appendChild(legacy);
})();
