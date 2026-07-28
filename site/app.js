(() => {
  const VERSION = "1.151.2";
  const CHANGELOG_DESCRIPTION = "Load player, club, and agent search data only when a search field is activated";
  const originalFetch = window.fetch.bind(window);
  let searchDataAllowed = false;
  let evaluationSearchActivationPromise = null;

  function parsedRequestUrl(input) {
    try {
      const value = input instanceof Request ? input.url : String(input || "");
      return new URL(value, window.location.href);
    } catch {
      return null;
    }
  }

  function isDeferredSearchRequest(input) {
    const url = parsedRequestUrl(input);
    if (!url) return false;

    const file = String(url.searchParams.get("file") || "").toLowerCase();
    const path = url.pathname.toLowerCase();
    const bootstrapRequest = path === "/api/data" && url.searchParams.get("mode") === "bootstrap";
    const walletNamesRequest = path === "/data/wallets.json" || file === "wallets.json";
    const searchExportRequest = /(^|\/)(players_search|agents_search)\.json$/.test(path)
      || file === "players_search.json"
      || file === "agents_search.json";

    return bootstrapRequest || walletNamesRequest || searchExportRequest;
  }

  function deferredSearchResponse() {
    return new Response(JSON.stringify({ error: "Search data is loaded after search activation." }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }

  window.fetch = (input, init) => {
    if (!searchDataAllowed && isDeferredSearchRequest(input)) {
      return Promise.resolve(deferredSearchResponse());
    }
    return originalFetch(input, init);
  };

  function allowSearchData() {
    searchDataAllowed = true;
  }

  function activateEvaluationSearch() {
    allowSearchData();
    if (evaluationSearchActivationPromise || typeof ensureSearchIndexes !== "function") {
      return;
    }

    const needsSearchData = typeof state !== "undefined" && !state.searchIndexesLoaded;
    if (!needsSearchData) {
      if (typeof renderEvaluationSearchResults === "function") {
        renderEvaluationSearchResults();
      }
      return;
    }

    if (typeof beginInteractionBusy === "function") {
      beginInteractionBusy();
    }

    evaluationSearchActivationPromise = Promise.resolve(ensureSearchIndexes())
      .then(() => {
        if (typeof renderEvaluationSearchResults === "function") {
          renderEvaluationSearchResults();
        }
      })
      .catch(() => false)
      .finally(() => {
        evaluationSearchActivationPromise = null;
        if (typeof endInteractionBusy === "function") {
          endInteractionBusy();
        }
      });
  }

  document.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("#openSearchButton")) {
      allowSearchData();
    }
  }, true);

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      allowSearchData();
    }
  }, true);

  document.addEventListener("focusin", (event) => {
    if (event.target instanceof Element && event.target.matches("#evaluationSearchInput")) {
      activateEvaluationSearch();
    }
  }, true);

  function patchVersionUi() {
    const footerLink = document.querySelector('.siteFooter a[data-page="changelog"]');
    if (footerLink) {
      footerLink.textContent = `MFL Front Office v${VERSION}`;
    }

    const list = document.querySelector(".changelogList");
    if (!list) return;

    const minorVersion = `v${VERSION.split(".").slice(0, 2).join(".")}`;
    let section = Array.from(list.querySelectorAll(":scope > .changelogMinorSection")).find((candidate) =>
      candidate.querySelector(".changelogMinorVersion")?.textContent?.trim() === minorVersion,
    );

    if (!section) {
      section = document.createElement("li");
      section.className = "changelogMinorSection";

      const toggle = document.createElement("button");
      toggle.className = "changelogMinorToggle";
      toggle.type = "button";
      toggle.setAttribute("aria-expanded", "true");

      const version = document.createElement("span");
      version.className = "changelogMinorVersion";
      version.textContent = minorVersion;

      const meta = document.createElement("span");
      meta.className = "changelogMinorMeta";
      meta.textContent = "1 patch";

      const chevron = document.createElement("span");
      chevron.className = "changelogMinorChevron";
      chevron.setAttribute("aria-hidden", "true");
      chevron.textContent = "▾";
      toggle.append(version, meta, chevron);

      const panel = document.createElement("div");
      panel.className = "changelogMinorPanel";
      const inner = document.createElement("div");
      inner.className = "changelogMinorPanelInner";
      const patchList = document.createElement("ol");
      patchList.className = "changelogPatchList";
      inner.appendChild(patchList);
      panel.appendChild(inner);
      section.append(toggle, panel);

      toggle.addEventListener("click", () => {
        const expanded = section.classList.toggle("collapsed") === false;
        toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      });
      list.prepend(section);
    }

    const patchList = section.querySelector(".changelogPatchList");
    if (!patchList) return;

    let item = Array.from(patchList.children).find((candidate) =>
      candidate.querySelector(":scope > span")?.textContent?.trim() === `v${VERSION}`,
    );
    if (!item) {
      item = document.createElement("li");
      const version = document.createElement("span");
      version.textContent = `v${VERSION}`;
      const description = document.createElement("p");
      description.textContent = CHANGELOG_DESCRIPTION;
      item.append(version, description);
      patchList.prepend(item);
    }

    Array.from(patchList.children)
      .sort((a, b) => String(b.querySelector("span")?.textContent || "").localeCompare(
        String(a.querySelector("span")?.textContent || ""),
        undefined,
        { numeric: true },
      ))
      .forEach((entry) => patchList.appendChild(entry));

    const patchCount = patchList.children.length;
    const meta = section.querySelector(".changelogMinorMeta");
    if (meta) {
      meta.textContent = `${patchCount} ${patchCount === 1 ? "patch" : "patches"}`;
    }
  }

  const coreScript = document.createElement("script");
  coreScript.src = `/app-core.js?v=${VERSION}`;
  coreScript.async = false;
  coreScript.addEventListener("load", () => {
    patchVersionUi();
    window.setTimeout(patchVersionUi, 0);
  });
  coreScript.addEventListener("error", () => {
    console.error("Could not load the MFL Front Office application core.");
  });
  document.currentScript.after(coreScript);
})();
