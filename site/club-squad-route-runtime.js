(() => {
  "use strict";

  const ATTRIBUTES_ROUTE = /^(\/(?:clubs|club)\/[^/?#]+)\/attributes\/?$/i;
  const SQUAD_ROUTE = /^(\/(?:clubs|club)\/[^/?#]+)\/squad\/?$/i;
  const CLUB_ROUTE = /^\/(?:clubs|club)\/([^/?#]+)(?:\/([^/?#]+))?\/?$/i;
  const CLUB_IDENTITY_STORAGE_PREFIX = "mfl-club-identity-v1:";
  const CLUB_VIEWS = new Set(["attributes", "contracts", "current", "all"]);
  const CLUB_VIEW_SLUGS = Object.freeze({
    attributes: "attributes",
    squad: "attributes",
    contracts: "contracts",
    current: "current",
    "current-season": "current",
    all: "all",
    "all-time": "all",
  });
  const nativePushState = history.pushState.bind(history);
  const nativeReplaceState = history.replaceState.bind(history);
  let historyWrapped = false;

  function currentRelativeUrl() {
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
  }

  function mappedRelativeUrl(value, target) {
    if (value === null || value === undefined) return value;
    try {
      const url = new URL(String(value), window.location.href);
      if (url.origin !== window.location.origin) return value;
      const matcher = target === "squad" ? ATTRIBUTES_ROUTE : SQUAD_ROUTE;
      const match = url.pathname.match(matcher);
      if (!match) return value;
      url.pathname = `${match[1]}/${target}`;
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return value;
    }
  }

  function clubRoute(pathname = window.location.pathname) {
    const match = String(pathname || "").match(CLUB_ROUTE);
    if (!match) return null;
    let clubId = "";
    try {
      clubId = decodeURIComponent(match[1]).trim();
    } catch {
      clubId = String(match[1] || "").trim();
    }
    if (!clubId) return null;
    const view = CLUB_VIEW_SLUGS[String(match[2] || "attributes").toLowerCase()] || "attributes";
    return CLUB_VIEWS.has(view) ? { clubId, view } : null;
  }

  function cleanCssColor(value) {
    const color = String(value || "").trim();
    if (!color) return "";
    try {
      return CSS.supports("color", color) ? color : "";
    } catch {
      return "";
    }
  }

  function normalizedClubIdentity(value) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return {
      name: String(source.name || "").trim(),
      divisionName: String(source.divisionName || "").trim(),
      divisionColor: cleanCssColor(source.divisionColor),
    };
  }

  function storedClubIdentity(clubId) {
    const id = String(clubId || "").trim();
    if (!id) return normalizedClubIdentity(null);
    try {
      return normalizedClubIdentity(JSON.parse(localStorage.getItem(`${CLUB_IDENTITY_STORAGE_PREFIX}${id}`) || "null"));
    } catch {
      return normalizedClubIdentity(null);
    }
  }

  function storeClubIdentity(clubId, identity) {
    const id = String(clubId || "").trim();
    if (!id) return normalizedClubIdentity(null);
    const previous = storedClubIdentity(id);
    const incoming = normalizedClubIdentity(identity);
    const merged = {
      name: incoming.name || previous.name,
      divisionName: incoming.divisionName || previous.divisionName,
      divisionColor: incoming.divisionColor || previous.divisionColor,
    };
    if (!merged.name && !merged.divisionName) return merged;
    try {
      localStorage.setItem(`${CLUB_IDENTITY_STORAGE_PREFIX}${id}`, JSON.stringify(merged));
    } catch {
      // The current navigation can still use the identity from the clicked element.
    }
    return merged;
  }

  function liveClubIdentity(clubId) {
    const id = String(clubId || "").trim();
    if (!id) return normalizedClubIdentity(null);
    window.__mflClubStaticIdentityId = id;
    try {
      return normalizedClubIdentity(window.eval(`(() => {
        try {
          const id = String(window.__mflClubStaticIdentityId || "").trim();
          if (!id || typeof state !== "object" || !Array.isArray(state.clubSearchIndex)) return null;
          const entry = state.clubSearchIndex.find((club) => String(club?.clubId || "") === id);
          if (!entry) return null;
          const division = typeof contractDivisionInfo === "function" ? contractDivisionInfo(entry.division) : null;
          return {
            name: String(entry.name || "").trim(),
            divisionName: String(division?.name || "").trim(),
            divisionColor: String(division?.color || "").trim(),
          };
        } catch {
          return null;
        }
      })()`));
    } catch {
      return normalizedClubIdentity(null);
    } finally {
      delete window.__mflClubStaticIdentityId;
    }
  }

  function identityForClub(clubId) {
    const stored = storedClubIdentity(clubId);
    const live = liveClubIdentity(clubId);
    return storeClubIdentity(clubId, {
      name: live.name || stored.name,
      divisionName: live.divisionName || stored.divisionName,
      divisionColor: live.divisionColor || stored.divisionColor,
    });
  }

  function internalizeCurrentSquadRoute() {
    const current = currentRelativeUrl();
    const internal = mappedRelativeUrl(current, "attributes");
    if (internal === current) return false;
    window.__mflInitialClubSquadUrl = current;
    nativeReplaceState(history.state, "", internal);
    return true;
  }

  function externalizeCurrentClubRoute() {
    const current = currentRelativeUrl();
    const external = mappedRelativeUrl(current, "squad");
    if (external !== current) {
      nativeReplaceState(history.state, "", external);
    }
  }

  function rewriteClubLinks() {
    document.querySelectorAll("a[href]").forEach((link) => {
      if (!(link instanceof HTMLAnchorElement)) return;
      const current = link.href;
      const external = mappedRelativeUrl(current, "squad");
      if (external !== current && external !== null && external !== undefined) {
        link.href = external;
      }
    });
  }

  function divisionIdentityFromElement(element) {
    if (!(element instanceof Element)) return { divisionName: "", divisionColor: "" };
    const division = element.matches(".clubSearchDivision, .playerContractDivision, .contractDivisionLabel")
      ? element
      : element.querySelector(".clubSearchDivision, .playerContractDivision, .contractDivisionLabel");
    if (!(division instanceof HTMLElement)) return { divisionName: "", divisionColor: "" };
    return {
      divisionName: String(division.textContent || "").trim(),
      divisionColor: cleanCssColor(division.style.color || getComputedStyle(division).color),
    };
  }

  function rememberClubIdentityFromEvent(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const searchResult = target.closest(".clubSearchResult[data-club-id]");
    if (searchResult instanceof HTMLElement) {
      const clubId = String(searchResult.dataset.clubId || "").trim();
      const name = String(searchResult.querySelector("strong")?.textContent || "").trim();
      const division = divisionIdentityFromElement(searchResult);
      const live = liveClubIdentity(clubId);
      storeClubIdentity(clubId, {
        name: live.name || name,
        divisionName: live.divisionName || division.divisionName,
        divisionColor: live.divisionColor || division.divisionColor,
      });
      queueMicrotask(syncStaticClubShell);
      return;
    }

    const link = target.closest("a.clubPageLink[href]");
    if (!(link instanceof HTMLAnchorElement)) return;
    let route = null;
    try {
      route = clubRoute(new URL(link.href, window.location.href).pathname);
    } catch {
      route = null;
    }
    if (!route) return;
    const context = link.closest("tr, .playerContractLine, .detailGrid, .searchResult") || link.parentElement;
    const division = divisionIdentityFromElement(context);
    const live = liveClubIdentity(route.clubId);
    storeClubIdentity(route.clubId, {
      name: live.name || String(link.textContent || "").trim(),
      divisionName: live.divisionName || division.divisionName,
      divisionColor: live.divisionColor || division.divisionColor,
    });
    queueMicrotask(syncStaticClubShell);
  }

  function clubTitleIdentity(route) {
    const title = document.getElementById("tablePageTitle");
    if (!(title instanceof HTMLElement) || document.body?.dataset.page !== "club") return;
    const division = title.querySelector(".clubPageTitleDivision");
    const divisionName = String(division?.textContent || "").trim();
    let name = "";
    if (division) {
      const firstText = Array.from(title.childNodes)
        .filter((node) => node !== division)
        .map((node) => String(node.textContent || ""))
        .join("")
        .replace(/\s*-\s*$/, "")
        .trim();
      name = firstText;
    } else {
      name = String(title.textContent || "").trim();
    }
    if (!name || name === `Club ${route.clubId}` || name === "Progression") return;
    storeClubIdentity(route.clubId, {
      name,
      divisionName,
      divisionColor: division instanceof HTMLElement ? cleanCssColor(division.style.color || getComputedStyle(division).color) : "",
    });
  }

  function staticClubTitleMatches(title, identity, clubId) {
    if (!(title instanceof HTMLElement)) return false;
    const expectedName = identity.name || `Club ${clubId}`;
    const division = title.querySelector(".clubPageTitleDivision");
    const actualDivision = String(division?.textContent || "").trim();
    const actualName = division
      ? Array.from(title.childNodes)
          .filter((node) => node !== division)
          .map((node) => String(node.textContent || ""))
          .join("")
          .replace(/\s*-\s*$/, "")
          .trim()
      : String(title.textContent || "").trim();
    return actualName === expectedName && actualDivision === identity.divisionName;
  }

  function renderStaticClubTitle(route) {
    const title = document.getElementById("tablePageTitle");
    if (!(title instanceof HTMLElement)) return;
    const identity = identityForClub(route.clubId);
    if (staticClubTitleMatches(title, identity, route.clubId)) return;
    const name = identity.name || `Club ${route.clubId}`;
    if (!identity.divisionName) {
      title.textContent = name;
      return;
    }
    const division = document.createElement("span");
    division.className = "clubPageTitleDivision";
    if (identity.divisionColor) division.style.color = identity.divisionColor;
    division.textContent = identity.divisionName;
    title.replaceChildren(document.createTextNode(`${name} - `), division);
  }

  function syncStaticClubViews(route = clubRoute()) {
    const views = document.querySelector("#progressionPage .views");
    if (!(views instanceof HTMLElement) || !route) return;
    views.querySelectorAll(":scope > .viewButton[data-view]").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const view = String(button.dataset.view || "");
      const allowed = CLUB_VIEWS.has(view);
      button.hidden = !allowed;
      if (view === "attributes" && button.textContent !== "Squad") button.textContent = "Squad";
      button.classList.toggle("active", allowed && view === route.view);
    });
    const switcher = document.getElementById("watchlistSwitcher");
    if (switcher instanceof HTMLElement) switcher.hidden = true;
  }

  function hideStaticClubOnlyControls() {
    const quickFilters = document.querySelector("#progressionPage .quickFilters");
    if (quickFilters instanceof HTMLElement) quickFilters.hidden = true;
    const controlsBar = document.querySelector("#progressionPage .controlsBar");
    if (controlsBar instanceof HTMLElement) controlsBar.hidden = true;
    document.querySelectorAll("#progressionPage .pager, #progressionPage nav.pager").forEach((pager) => {
      if (pager instanceof HTMLElement) pager.hidden = true;
    });
  }

  function staticClubShellNeeded() {
    const route = clubRoute();
    if (!route) return false;
    return document.documentElement.dataset.mflReady !== "true"
      || document.documentElement.classList.contains("mflDataLoading")
      || document.body?.classList.contains("clubViewSwitching")
      || document.body?.dataset.page !== "club";
  }

  function syncStaticClubShell() {
    const route = clubRoute();
    if (!route) return;
    clubTitleIdentity(route);
    syncStaticClubViews(route);
    hideStaticClubOnlyControls();
    if (!staticClubShellNeeded()) return;

    if (document.body) document.body.dataset.page = "club";
    const progressionPage = document.getElementById("progressionPage");
    if (progressionPage instanceof HTMLElement) {
      document.querySelectorAll("main > .pageView").forEach((page) => {
        if (page instanceof HTMLElement) page.hidden = page !== progressionPage;
      });
      progressionPage.hidden = false;
    }
    renderStaticClubTitle(route);
  }

  function syncClubViewLabel() {
    const button = document.querySelector('#progressionPage .viewButton[data-view="attributes"]');
    if (!(button instanceof HTMLButtonElement)) return;
    const label = document.body?.dataset.page === "club" ? "Squad" : "Attributes";
    if (button.textContent !== label) button.textContent = label;
  }

  function syncUi() {
    rewriteClubLinks();
    syncClubViewLabel();
    syncStaticClubShell();
  }

  function wrapHistory() {
    if (historyWrapped) return;
    historyWrapped = true;

    history.pushState = function(state, title, url) {
      const mapped = mappedRelativeUrl(url, "squad");
      nativePushState(state, title, mapped);
      queueMicrotask(syncUi);
    };

    history.replaceState = function(state, title, url) {
      const mapped = mappedRelativeUrl(url, "squad");
      nativeReplaceState(state, title, mapped);
      queueMicrotask(syncUi);
    };
  }

  function onPopState() {
    const external = currentRelativeUrl();
    const internal = mappedRelativeUrl(external, "attributes");
    if (internal === external) {
      queueMicrotask(syncStaticClubShell);
      return;
    }

    // Core still uses the internal "attributes" view key. Let its popstate
    // parser see that route synchronously, then restore the public Squad slug.
    nativeReplaceState(history.state, "", internal);
    queueMicrotask(() => {
      nativeReplaceState(history.state, "", external);
      syncStaticClubShell();
    });
  }

  internalizeCurrentSquadRoute();
  document.addEventListener("pointerdown", rememberClubIdentityFromEvent, true);
  document.addEventListener("click", rememberClubIdentityFromEvent, true);
  window.addEventListener("popstate", onPopState, true);
  syncStaticClubShell();

  const observer = new MutationObserver(syncUi);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-page", "href", "class"],
    childList: true,
    subtree: true,
  });

  window.addEventListener("mfl:ready", () => {
    wrapHistory();
    externalizeCurrentClubRoute();
    syncUi();
  });
})();
