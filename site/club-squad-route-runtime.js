(() => {
  "use strict";

  const ATTRIBUTES_ROUTE = /^(\/(?:clubs|club)\/[^/?#]+)\/attributes\/?$/i;
  const SQUAD_ROUTE = /^(\/(?:clubs|club)\/[^/?#]+)\/squad\/?$/i;
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

  function syncClubViewLabel() {
    const button = document.querySelector('#progressionPage .viewButton[data-view="attributes"]');
    if (!(button instanceof HTMLButtonElement)) return;
    const label = document.body?.dataset.page === "club" ? "Squad" : "Attributes";
    if (button.textContent !== label) button.textContent = label;
  }

  function syncUi() {
    rewriteClubLinks();
    syncClubViewLabel();
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
    if (internal === external) return;

    // Core still uses the internal "attributes" view key. Let its popstate
    // parser see that route synchronously, then restore the public Squad slug.
    nativeReplaceState(history.state, "", internal);
    queueMicrotask(() => nativeReplaceState(history.state, "", external));
  }

  internalizeCurrentSquadRoute();
  window.addEventListener("popstate", onPopState, true);

  const observer = new MutationObserver(syncUi);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-page", "href"],
    childList: true,
    subtree: true,
  });

  window.addEventListener("mfl:ready", () => {
    wrapHistory();
    externalizeCurrentClubRoute();
    syncUi();
  });
})();
