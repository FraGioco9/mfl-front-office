(() => {
  const VERSION = "1.120.21";
  const VIEW_BY_SLUG = {
    attributes: "attributes",
    "next-overall": "next",
    contracts: "contracts",
    "current-season": "current",
    "all-time": "all",
  };
  const SLUG_BY_VIEW = {
    attributes: "attributes",
    next: "next-overall",
    contracts: "contracts",
    current: "current-season",
    all: "all-time",
  };
  const MAX_WAIT_MS = 15000;

  const existing = window.__mflMyPlayersRefreshViewRuntime;
  if (existing?.version === VERSION) {
    existing.rebind?.();
    return;
  }
  existing?.destroy?.();

  const rememberedPath = String(window.__mflInitialMyPlayersPath || "")
    .replace(/\/+$/, "");
  const match = rememberedPath.match(/^\/my-players\/(attributes|next-overall|contracts|current-season|all-time)$/i);
  const desiredSlug = String(match?.[1] || "").toLowerCase();
  const desiredView = VIEW_BY_SLUG[desiredSlug] || "";
  const startedAt = Date.now();

  let interval = 0;
  let destroyed = false;

  function syncFooter() {
    const footer = document.querySelector(".siteFooter");
    if (!(footer instanceof HTMLElement)) return;

    let link = footer.querySelector('a[href="/changelog"], a[data-page="changelog"]');
    if (!(link instanceof HTMLAnchorElement)) {
      link = document.createElement("a");
      footer.prepend(link);
    }

    const text = `MFL Front Office v${VERSION}`;
    link.hidden = false;
    link.removeAttribute("aria-hidden");
    link.href = "/changelog";
    link.dataset.page = "changelog";
    link.dataset.releaseLabel = text;
    link.textContent = text;
    link.setAttribute("aria-label", `${text}, open Changelog`);
    footer.dataset.releaseVersion = VERSION;
  }

  function currentAppState() {
    try {
      return typeof state === "object" && state ? state : null;
    } catch {
      return null;
    }
  }

  function currentPath() {
    return String(window.location.pathname || "/").replace(/\/+$/, "") || "/";
  }

  function finish() {
    if (interval) clearInterval(interval);
    interval = 0;
    window.__mflInitialMyPlayersPath = "";
  }

  function restoreView() {
    if (destroyed) return;
    syncFooter();

    if (!desiredView) {
      finish();
      return;
    }

    const path = currentPath();
    if (!/^\/my-players(?:\/|$)/i.test(path)) {
      finish();
      return;
    }

    const appState = currentAppState();
    if (appState && appState.currentPage !== "myplayers") {
      if (Date.now() - startedAt >= MAX_WAIT_MS) finish();
      return;
    }

    const page = document.getElementById("progressionPage");
    const button = page?.querySelector(`.viewButton[data-view="${desiredView}"]`);
    if (!(button instanceof HTMLButtonElement) || button.disabled || button.hidden) {
      if (Date.now() - startedAt >= MAX_WAIT_MS) finish();
      return;
    }

    const canonicalPath = `/my-players/${SLUG_BY_VIEW[desiredView]}`;
    if (!button.classList.contains("active")) {
      button.click();
    }

    window.setTimeout(() => {
      if (destroyed) return;
      if (/^\/my-players(?:\/|$)/i.test(currentPath()) && currentPath() !== canonicalPath) {
        window.history.replaceState({}, "", canonicalPath);
      }
      finish();
    }, 0);
  }

  function rebind() {
    if (destroyed) return;
    restoreView();
  }

  interval = window.setInterval(restoreView, 100);
  restoreView();

  function destroy() {
    destroyed = true;
    if (interval) clearInterval(interval);
    interval = 0;
  }

  window.__mflMyPlayersRefreshViewRuntime = {
    version: VERSION,
    rebind,
    destroy,
  };
})();
